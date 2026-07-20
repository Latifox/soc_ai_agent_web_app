# 02 — System Architecture

## 1. Architecture at a glance

```
                            ┌──────────────────────────────────────────────┐
   Analysts / Admins  ──►   │   Next.js 16 Web App (App Router, SSR/stream) │
                            │   shadcn/ui · TanStack Query · WS live feed   │
                            └───────────────┬──────────────────────────────┘
                                            │ HTTPS (OIDC session / JWT)
                                            ▼
                            ┌──────────────────────────────────────────────┐
                            │   API Gateway / BFF  (FastAPI, Python 3.13)   │
                            │   authZ (RBAC) · tenant context · OpenAPI     │
                            └───┬───────────┬───────────┬──────────┬────────┘
                                │           │           │          │
                 ┌──────────────▼──┐  ┌─────▼─────┐ ┌───▼────┐ ┌───▼─────────────┐
                 │ Rules / Cases   │  │ Detection │ │ Agent  │ │ Integrations /   │
                 │ /Incidents svc  │  │ Runtime   │ │ Service│ │ Ingestion svc    │
                 │ (Postgres+RLS)  │  │ scheduler │ │(Argus) │ │ (Vector, conns)  │
                 └───────┬─────────┘  └────┬──────┘ └───┬────┘ └───────┬──────────┘
                         │                 │            │              │
        ┌────────────────┼─────────────────┼────────────┼──────────────┼───────────┐
        ▼                ▼                 ▼            ▼              ▼           ▼
  ┌──────────┐   ┌───────────────┐  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐
  │ Supabase │   │  ClickHouse   │  │ OpenSearch│ │  Redis   │ │ Local FS │ │ AgentOS │
  │(PG+Auth+ │   │ chdb(local)/  │  │ +agent-svr│ │(cache,   │ │  ./data  │ │  (Agno) │
  │  RLS)    │   │ server(prod)  │  │ (MCP :8001)│ │ queues)  │ │(archive) │ │ durable │
  └──────────┘   └───────────────┘  └───────────┘ └──────────┘ └──────────┘ └─────────┘
                         ▲
                         │ normalized ECS events
        ┌────────────────┴───────────────────────────────────────────────┐
        │  Vector pipelines (per source): collect → parse → VRL normalize │
        │  sources: AWS/Azure/GCP/K8s/Cloudflare/Docker/Datadog/Okta/     │
        │           Syslog/HTTP/S3/Kafka  → sinks: ClickHouse, OpenSearch │
        └────────────────────────────────────────────────────────────────┘

        External LLM: Claude (Anthropic API) ── tools via MCP servers ◄── Agent Service
        External TI: VirusTotal / AbuseIPDB / OTX / MISP  (Threat-Intel MCP)
        External SIEM (federation): Splunk / Elastic / Microsoft Sentinel
```

## 2. Services (bounded contexts)

| Service | Responsibility | Store |
|---------|----------------|-------|
| **Web App** | UI, SSR, live case feed | — |
| **API/BFF** | AuthN/Z, tenant context, request routing, OpenAPI, WS | Postgres |
| **Rules & Cases svc** | CRUD for rules, incidents, cases, assets, folders | Postgres (RLS) |
| **Detection Runtime** | Schedule + compile + execute rules; correlate → incidents | ClickHouse / OpenSearch |
| **Ingestion svc** | Manage Vector pipelines, connectors, secrets, health | Postgres + Vector |
| **Agent Service (Argus)** | Agno multi-agent (Team + Workflows) served by **AgentOS**; Claude models + MCP tools | Postgres (sessions/state) |
| **Automation/SOAR svc** | Playbooks, action executors, approval gates | Postgres |
| **Search/Federation svc** | Query ClickHouse/OpenSearch + external SIEMs | — |
| **Notification svc** | Slack/Teams/email/PagerDuty, webhooks | Redis |
| **Reporting svc** | Metrics rollups, exec reports | ClickHouse + Postgres |

Services are logically separate; deployable as a modular monolith first, split to
microservices as scale demands. Python services share a common `aegis-core` lib
(tenant context, auth, models, tracing).

## 3. Tech stack & rationale

### Frontend
- **Next.js 16 (App Router)** + React + **TypeScript**. Server Components for data-heavy
  pages, streaming for agent output, Server Actions for mutations.
- **Tailwind CSS + shadcn/ui** — matches the clean dashboard aesthetic in the teardown.
- **TanStack Query** for client cache; **WebSocket/SSE** for live case & agent streams.
- **Monaco editor** for the YAML rule editor (split view, schema validation, lint).
- **OpenUI** (`@openuidev/*`, OpenUI Lang) for the chat / AI Assistant — agents reply with
  streamed, safe, interactive generative UI. See [09](09-chat-generative-ui.md).
- **Supabase Auth** via `@supabase/ssr` — cookie-based sessions in the App Router; tenant +
  role claims travel in the JWT and drive Postgres RLS.

### Backend / API
- **FastAPI (Python 3.13)** — async, typed, OpenAPI-native. Same language as the agents
  and the data tooling (ClickHouse driver, Vector configs, Sigma tooling).
- **Pydantic v2** models shared across API + agents.
- **SQLAlchemy 2 + Alembic** for Postgres; **clickhouse-connect** for ClickHouse.
- **Uvicorn/Gunicorn**; deploy on containers (K8s) or Fluid Compute for the BFF.

### Why Python for the core
The agent stack (**Agno / AgentOS**, MCP), the detection tooling (Sigma, Spark/PySpark),
and the data ecosystem are Python-first. One language for API + runtime + agents reduces
glue and lets Pydantic models flow end-to-end.

### Data stores — see [04-data-and-tenancy](04-data-and-tenancy.md)
- **ClickHouse** — primary security datalake: raw+normalized events, detection results,
  analytics. Columnar, cheap at SIEM scale, sub-second aggregations. **Local dev uses
  chdb** (in-process, no server); prod uses a ClickHouse server. See [10](10-external-tools.md).
- **OpenSearch** — full-text search, correlation, and the federation target that lets us
  "detect where the data lives" against existing Elastic/OpenSearch estates. The
  **OpenSearch Agent Server** (`--with-mcp`, :8001) is the agent tool/MCP layer over it.
- **Supabase (managed PostgreSQL)** — application metadata with **Row-Level Security**
  for tenant isolation (tenants, users, roles, rules, incidents, cases, assets,
  integrations, playbooks, audit). **Supabase Auth** issues the JWTs whose `tenant_id` +
  `role` claims the RLS policies read. Agno's `PostgresDb` uses the same instance.
- **Redis** — sessions, rate limiting, hot cache, lightweight job queues, pub/sub for
  live UI.
- **Local filesystem `./data`** (dev, **no S3**) — raw log archive, case artifacts,
  generated reports; swap to Supabase Storage / S3 in prod via the `aegis-core.storage`
  abstraction.

### Agents & LLM — see [03-agents](03-agents.md)
- **Agno** — the agent framework: agents + **Teams** (multi-agent), **Workflows 2.0**
  (`Loop`/`Condition`/`Router` = the autonomous loop), **tool hooks** + **guardrails** +
  HITL `requires_confirmation` (approval gates), memory + knowledge (RAG), `PostgresDb`.
- **AgentOS** — self-hosted runtime: FastAPI app (`.get_app()`), 80+ REST endpoints (runs,
  sessions, memory, traces, evals, schedules, **approvals**), browser control plane,
  JWT+RBAC. Data stays in our own DB.
- **MCP servers** expose tools (SIEM query, ClickHouse, threat intel, SOAR actions).
- **Claude** (Fable 5 hard reasoning, Sonnet 5 balanced, Haiku 4.5 cheap classification)
  via the Anthropic API. Optional **AI Gateway** for routing/fallback/cost.
- **Langfuse** for LLM tracing/evals/cost; **OpenTelemetry** across services.

### Ingestion
- **Vector** (Rust) per-source pipelines: collect → parse → **VRL** normalize to ECS →
  sink to ClickHouse (+ OpenSearch + S3 archive). Backpressure, buffering, at-least-once.
- **Redpanda/Kafka** as the durable bus for high-volume tenants / replay.

### Orchestration / workflows
- **Agno Workflows 2.0 + AgentOS `PostgresDb`** for agent state durability and resumable
  paused (awaiting-approval) runs.
- **Temporal** (optional) for long-running SOAR workflows, retries, human-wait steps, and
  the detection scheduler at scale. Start with APScheduler/Celery-beat + Redis; graduate
  to Temporal.

## 4. Request & data flows

### 4.1 Ingest → detect → incident
1. Source → Vector → normalize (ECS) → **ClickHouse** (hot) + S3 (archive) [+ OpenSearch].
2. **Detection Runtime** scheduler picks enabled rules per tenant on their `frequency`;
   compiles rule → ClickHouse SQL (or OpenSearch DSL / Spark / Python); runs over `depth`.
3. Matches → **detections** table; correlation clusters them → **Incident** (Postgres).
4. Incident event published (Redis) → **Agent Service** picks it up.

### 4.2 Autonomous triage → response (see 03-agents §5)
1. Supervisor (Agno Team leader) delegates to the **Triage agent** (Workflow step).
2. Triage → dedup/score → escalate → **Investigation agent** loop (enrich via MCP tools,
   query ClickHouse/OpenSearch, threat-intel lookups, build narrative + MITRE map) until
   confident or `max_iterations`.
3. Recommends action → **Response agent** proposes a SOAR playbook → autonomy-policy
   check; if destructive & not auto-approved, the `requires_confirmation` tool **pauses
   the run** → analyst approves in the OpenUI chat → action executes → **tool audit hook**
   records it.
4. **Reporting agent** writes the case; incident/case updated (Postgres); UI live-updates.

### 4.3 Interactive rule authoring
- Analyst opens rule editor (Monaco) → Details panel + YAML → **Assistant** tab (Vibe):
  NL prompt → Detection-Engineering agent generates YAML → preview diff → Apply →
  optional **backtest** against ClickHouse → Save (version bump).

## 5. Multi-tenancy (summary — full model in [04](04-data-and-tenancy.md))
- Every request carries a **tenant context** from the **Supabase Auth JWT** (`tenant_id` +
  `role` claims). Postgres **RLS** policies read `auth.jwt() ->> 'tenant_id'` (and the BFF
  also sets `app.current_tenant` on service connections) → all rows filtered by tenant.
- ClickHouse: `tenant_id` low-cardinality column on every table + **row policies** +
  per-tenant quotas; queries always constrained by tenant.
- OpenSearch: per-tenant index prefix `t-{tenant}-*` and/or **document-level security**.
- Secrets (connector creds, API keys) namespaced per tenant in the vault.
- Object storage namespaced per tenant: `./data/storage/tenant={id}/…` (local dev; an S3
  prefix in prod).

## 6. Deployment topology
- **Dev (local-first, no S3):** **Supabase CLI** (`supabase start` → local Postgres +
  Auth + Storage) + docker-compose for OpenSearch (+ `opensearch-agent-server`), Redis,
  Vector, Langfuse. **ClickHouse runs as local chdb** (in-process, no server); object
  archive is local `./data`. Plus web + api + agent-worker.
- **Prod:** Kubernetes (Helm). Stateful sets for ClickHouse/OpenSearch (or managed:
  ClickHouse Cloud, AWS OpenSearch). Autoscaled stateless pods for API/agents/runtime.
  Vector as a DaemonSet/Deployment per source. Secrets via External Secrets + KMS.
- **Frontend** can deploy to Vercel (Fluid Compute) with the FastAPI backend behind a
  private network; or co-located in the cluster.

## 7. Security architecture (summary)
- TLS everywhere; mTLS between internal services (service mesh optional).
- Secrets in **Vault**/cloud KMS; no plaintext connector creds in DB.
- **Least-privilege connectors** (scoped cloud roles, read-only where possible).
- **Immutable audit log** (append-only, hash-chained) of user + agent actions.
- Agent **kill-switch** and **token/step budgets** per tenant; destructive-action
  policy engine (default: human approval).
- PII redaction option before sending event data to the LLM.

## 8. Key architectural decisions (ADR index)
1. **Python core** (not Node) — align with agent + data ecosystem. See §3.
2. **ClickHouse primary, OpenSearch federated** — cost + speed for detection; keep
   full-text + existing-estate federation.
3. **Supabase (Postgres RLS) for tenancy + auth** — auth and row-level isolation in one
   layer; tenant/role claims in the Supabase JWT drive RLS. Hard isolation without
   per-tenant DBs; escalate to schema/DB-per-tenant only for data-residency tiers.
4. **Agno + AgentOS** — one framework for tools/hooks/teams/Workflows-loops/HITL, plus a
   self-hosted runtime + control plane. Chat is generative UI via **OpenUI**. See
   [03](03-agents.md) and [09](09-chat-generative-ui.md).
5. **Detection-as-code YAML** — mirror Vinci's schema (portability) + Sigma import.
6. **Vector for ingestion** — vendor-neutral, high-throughput, ECS normalization.
