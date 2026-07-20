# 04 — Data Architecture & Multi-Tenancy

Three data planes, one isolation model. **Supabase Postgres** (metadata + auth + RLS),
**ClickHouse** (events datalake; chdb locally), **OpenSearch** (search + federation).
Object archive is **local `./data`** in dev (no S3). Tenant isolation is enforced at every
layer — defense in depth.

## 1. Data planes

| Plane | Store | Holds | Isolation |
|-------|-------|-------|-----------|
| Metadata | **Supabase Postgres** | tenants, users, roles, rules, incidents, cases, assets, integrations, playbooks, audit, agent sessions | **RLS** on `tenant_id`, driven by Supabase JWT claims |
| Events | **ClickHouse** (chdb local / server prod) | raw + ECS-normalized events, detections | `tenant_id` low-cardinality column + **row policies** + per-tenant quotas |
| Search | **OpenSearch** | full-text, correlation, federation to external SIEMs | per-tenant index prefix `t-{tenant}-*` + **document-level security (DLS)** |
| Archive | **Local FS `./data`** (dev) → S3/Supabase Storage (prod) | raw log cold archive, case artifacts, reports | path prefix `tenant={id}/` |

## 2. Tenant model

- **Tenant (organization)** is the isolation boundary. Users belong to one or more tenants
  via **memberships** (each with a role). The **active tenant** is encoded in the Supabase
  JWT as `tenant_id` (+ `role`, `permissions`).
- Every row in every plane carries `tenant_id`. No query path exists without it.
- Tier options (later): shared-DB + RLS (default), schema-per-tenant, DB-per-tenant for
  data-residency/enterprise.

## 3. Isolation enforcement (defense in depth)

### 3.1 Supabase Postgres — RLS
Every metadata table has `tenant_id uuid not null` and an RLS policy reading the JWT:

```sql
alter table public.rules enable row level security;

create policy tenant_isolation on public.rules
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```
- The frontend uses the tenant-scoped anon key + user JWT → RLS applies automatically.
- Backend service connections (FastAPI, Agno) also `SET LOCAL app.current_tenant = :tid`
  and policies fall back to that for service roles. **The service-role key is never sent
  to the browser** and is used only inside trusted services with explicit tenant scoping.

### 3.2 ClickHouse — row policies + tenant column
```sql
CREATE ROW POLICY tenant_events ON events
  USING tenant_id = currentSetting('aegis_tenant')  -- set per session/query
  TO all;
```
- The `mcp-clickhouse` tool and detection runtime always inject the tenant filter and set
  `aegis_tenant`; queries are parameterized (no string interpolation of tenant data).
- On **chdb** (local, in-process) the same `tenant_id` predicate is applied by the adapter;
  row policies apply on the server backend.
- Per-tenant **quotas** (rows read, memory) cap noisy tenants.

### 3.3 OpenSearch — index prefix + DLS
- Writes go to `t-{tenant}-{source}-*`; reads are constrained to the caller's prefix.
- **opensearch-agent-server** ([10](10-external-tools.md)) is wrapped so every tool call
  carries the tenant filter / DLS role — the agent cannot escape its tenant.

### 3.4 API + agents
- BFF derives `tenant_id` from the verified Supabase JWT; all downstream calls carry it.
- Agno `tenant_guard_hook` rewrites every tool arg to force tenant scope ([03 §6.1](03-agents.md)).
- **Automated isolation test suite** (TODO SEC-01) proves tenant B cannot read tenant A in
  any plane.

## 4. ClickHouse schema (core)

```sql
-- normalized security events (ECS-like)
CREATE TABLE events (
  tenant_id      LowCardinality(String),
  event_id       UUID,
  ts             DateTime64(3),            -- event.ingested / @timestamp
  source         LowCardinality(String),  -- integration id (fortinet, okta, aws…)
  index          LowCardinality(String),  -- logical index (syslog-fortinet-fw*)
  host_name      String,
  user_name      String,
  src_ip         IPv6,
  dst_ip         IPv6,
  dst_port       UInt16,
  event_category LowCardinality(String),
  event_type     LowCardinality(String),
  event_action   LowCardinality(String),
  raw            String,                   -- original JSON (or archive ref)
  ecs            JSON                      -- full normalized doc
) ENGINE = MergeTree
ORDER BY (tenant_id, ts, source)
PARTITION BY (tenant_id, toYYYYMMDD(ts))
TTL toDateTime(ts) + INTERVAL 90 DAY;      -- retention (per-tenant configurable)

-- detection matches
CREATE TABLE detections (
  tenant_id  LowCardinality(String),
  detection_id UUID,
  rule_id    UUID,
  ts         DateTime64(3),
  severity   LowCardinality(String),
  entities   Array(String),               -- host/user/ip involved
  event_ids  Array(UUID),
  fields     JSON
) ENGINE = MergeTree
ORDER BY (tenant_id, ts, rule_id)
PARTITION BY (tenant_id, toYYYYMMDD(ts));
```
- **chdb** runs the identical DDL locally (file-backed at `CHDB_PATH`).
- Detection SQL compiled from rules always begins with `WHERE tenant_id = {tenant}` and a
  `ts` window from the rule's `depth`.

## 5. Data flow & lifecycle

1. **Ingest:** source → Vector → VRL normalize to ECS → **ClickHouse `events`** (hot) +
   local `./data` archive of raw (cold) [+ OpenSearch for search].
2. **Detect:** scheduler runs rules → `detections`.
3. **Correlate:** detections cluster → **Incident** (Postgres).
4. **Investigate/Respond:** agents read ClickHouse/OpenSearch via MCP; write case updates
   to Postgres; artifacts/reports to local storage.
5. **Retention:** ClickHouse TTL + archive lifecycle per-tenant; audit log immutable.

## 6. Retention, residency, PII
- Per-tenant **retention** (hot days in ClickHouse, archive days) configurable.
- **PII redaction** option before event data reaches the LLM ([03 §6.3](03-agents.md)).
- Residency: shared-RLS default; escalate to isolated schema/DB/region for regulated tenants.

## 7. Local-first dev
- `CLICKHOUSE_BACKEND=chdb` → no ClickHouse server needed.
- `STORAGE_BACKEND=local` → archive/artifacts under `./data` (no S3/MinIO).
- Supabase local via `supabase start`; OpenSearch + `opensearch-agent-server` via compose.
- Contributors can run ingest → detect → triage end-to-end with zero cloud infra.
