# 08 — Roadmap & Delivery

Phases map to the tracks/tasks in [`/TODO.md`](../TODO.md). The build loop ([TODO §3](../TODO.md))
executes them.

## Phase 0 — Foundations
INFRA-01…08. Monorepo, Supabase (local), dev stack (chdb, OpenSearch + agent-server, no S3),
`aegis-core`, migrations, CI, storage/chdb abstraction, ClickHouse Agent Skills.
**Exit:** `supabase start` + `docker compose up` + `make migrate` all green.

## Phase 1 — Core (auth + tenancy + shells)
BE-01…04, FE-01…03. FastAPI skeleton, Supabase schema + RLS, JWT verification, tenant
middleware; Next.js shell + Supabase Auth + typed API client.
**Exit:** login → tenant-scoped empty dashboard; isolation test passes.

## Phase 2 — Data plane
BE-06…09, BE-07 (OpenSearch). ClickHouse schema (chdb), OpenSearch templates + DLS,
ingestion (Vector) + connectors + ECS normalization.
**Exit:** a connector's events land in ClickHouse, tenant-scoped.

## Phase 3 — Detect
BE-10…14, FE-04…09. Rules CRUD + compilers + scheduler + backtest; incidents/cases;
assets; integrations hub UI; rules + incidents + cases pages.
**Exit:** an enabled rule fires → incident → case, visible in UI.

## Phase 4 — Investigate (agents)
AI-01…08, FE-14…16. MCP tools (+ opensearch-agent-server), Argus crew, Team + Workflow,
HITL, AgentOS, RAG, Langfuse; OpenUI chat + generative components + stream proxy.
**Exit:** incident → Argus produces narrative + MITRE + recommendation in OpenUI chat;
destructive step pauses for approval.

## Phase 5 — Respond (SOAR + autonomy)
BE-15…16, FE-10. Action library + playbook engine; autonomy policy + kill-switch; SOAR UI +
approval queue.
**Exit:** approved playbook executes via a real connector; policy gates destructive actions.

## Phase 6 — Scale & hardening
FE-11…13, BE-17…19, OPS-01…02, SEC-01…02. Hunting, reports, admin/billing, API keys,
metrics; load test; isolation suite; immutable audit; threat model + secret scan.
**Exit:** NFRs met (isolation proven, p95 detection < 10s, audit complete).

## Success metrics (from [01 §7](01-prd.md))
- **North Star:** % alerts auto-resolved correctly by Argus (target 40% by v2),
  **false-auto-close < 1%**.
- MTTD/MTTR reduction; MITRE coverage; analyst time saved; ingest cost/GB vs legacy SIEM.

## Non-goals (v1)
Endpoint EDR sensor; building our own TI feeds; full GRC suite; air-gapped on-prem.

## Definition of done (per task)
Implemented to acceptance criteria · tests added · REVIEWER pass · verified
(tests/typecheck/`compose up`) · one commit · TODO box checked + commit hash logged.
