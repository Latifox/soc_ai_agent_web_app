# 07 — Data Model & API

## 1. Supabase Postgres schema (metadata)

Every table has `tenant_id uuid not null` + RLS ([04 §3.1](04-data-and-tenancy.md)),
except `tenants` itself (keyed by id) and global lookups.

```
tenants(id, name, slug, plan, retention_days, created_at)
users(id, email, name, created_at)                          -- mirrors auth.users
memberships(id, tenant_id, user_id, role, created_at)       -- user ↔ tenant ↔ role
roles(id, tenant_id, name, permissions jsonb)               -- custom roles
api_keys(id, tenant_id, name, hash, scopes jsonb, last_used, created_at)
audit_log(id, tenant_id, actor, actor_type, action, target, meta jsonb, ts, prev_hash, hash)

folders(id, tenant_id, name, parent_id)
rules(id, tenant_id, title, severity, type, enabled, learning_mode, yaml, tags text[],
      author, folder_id, version, mitre text[], created_at, updated_at)
rule_versions(id, rule_id, version, yaml, author, created_at)

incidents(id, tenant_id, title, description, rule_id, severity, status,
          assignee, tags text[], detected_at, created_at, correlation_key)
cases(id, tenant_id, code, title, description, status, assignee, tags text[],
      incident_id, sla_due, created_at, closed_at)
case_comments(id, case_id, author, body, created_at)
case_evidence(id, case_id, kind, ref, meta jsonb, created_at)   -- ref → local ./data
case_timeline(id, case_id, ts, actor, action, detail jsonb)

assets(id, tenant_id, kind, name, criticality, attributes jsonb, risk_score, updated_at)
entities(id, tenant_id, type, value, risk_score, first_seen, last_seen)   -- ip/user/host

integrations(id, tenant_id, provider, name, status, config jsonb, secret_ref, health jsonb)
playbooks(id, tenant_id, name, spec jsonb, enabled)
playbook_runs(id, tenant_id, playbook_id, trigger, status, steps jsonb, started, ended)
autonomy_policies(id, tenant_id, action_class, mode)    -- mode: auto|approve|deny
approvals(id, tenant_id, run_id, tool_name, args jsonb, status, decided_by, decided_at)

agent_sessions(...)   -- managed by Agno PostgresDb (runs, memory, metrics)
```

Indexes on `(tenant_id, ...)`; `rules.tags`, `incidents.status`, `cases.status` etc.

## 2. ClickHouse tables
`events`, `detections` — see [04 §4](04-data-and-tenancy.md). chdb locally, server in prod.

## 3. REST API surface (FastAPI BFF, `/api/v1`)

All routes require a verified Supabase JWT; tenant derived from claims.

```
# Rules & detection
GET/POST      /rules                 GET/PUT/DELETE /rules/{id}
POST          /rules/{id}/backtest   POST /rules/{id}/duplicate
POST          /rules/{id}/enable     POST /rules/{id}/disable
GET           /rules/{id}/versions   POST /rules/import   (Sigma)
GET/POST      /folders

# Incidents & cases
GET           /incidents             GET /incidents/{id}
GET/POST      /cases                 GET/PUT /cases/{id}
POST          /cases/{id}/comments   POST /cases/{id}/promote
GET           /cases/{id}/timeline

# Assets / entities
GET/POST      /assets                GET /assets/{id}
GET           /entities/{type}/{value}

# Integrations & ingestion
GET/POST      /integrations          PUT/DELETE /integrations/{id}
POST          /integrations/{id}/test   GET /integrations/{id}/health

# Automation / SOAR
GET/POST      /playbooks             GET /playbook-runs
GET           /approvals             POST /approvals/{id}   (approve|deny)
GET/PUT       /autonomy-policies

# Investigations / search
POST          /search                (KQL/SQL over ClickHouse/OpenSearch, tenant-scoped)
POST          /hunts                 GET /hunts

# Assistant (generative UI) — proxied to AgentOS
POST          /assistant/stream      (SSE; OpenUI Lang; injects tenant JWT)

# Reports / metrics
GET           /metrics               (MTTD/MTTR/FP/coverage)
POST          /reports               GET /reports/{id}

# Admin
GET/POST      /users /memberships /roles /api-keys
GET/PUT       /settings /billing

# Health
GET           /healthz  /readyz
```

## 4. Realtime
- **WS/SSE** channels (tenant-scoped): `incidents`, `cases`, `agent-runs`, `approvals`.
- Supabase Realtime optionally powers live table updates; agent streams come via the
  `/assistant/stream` SSE proxy to **AgentOS**.

## 5. AgentOS endpoints (via `opensearch`-style runtime, :7777)
Managed by Agno — runs, sessions, memory, traces, evals, schedules, **approvals**
([03 §9](03-agents.md)). The BFF proxies these with tenant-scoping; the browser never
calls AgentOS directly with secrets.

## 6. Conventions
- Pagination: cursor + `limit`. Filtering: `?status=`, `?severity=`, `?q=`.
- Errors: RFC-9457 problem+json. Idempotency keys on POST for actions.
- OpenAPI generated → typed TS client for the frontend ([FE-03]).
