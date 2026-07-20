# Aegis — Implementation TODO (agent-assigned + build loop)

This is the executable backlog for building Aegis. Every task is scoped, ordered by
dependency, and **assigned to a Claude Code agent**. A **build loop** (§3) works the list
top-to-bottom: pick the next unblocked task → implement → self-review → check the box →
commit → repeat.

- Spec of record: [`README.md`](README.md) + [`docs/`](docs/).
- Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked.
- Monorepo layout (target):
  ```
  aegis/
    apps/web/            # Next.js 16 frontend + OpenUI chat
    apps/api/            # FastAPI BFF
    services/agents/     # Agno agents + AgentOS runtime
    services/detection/  # rule scheduler + compilers
    services/ingestion/  # Vector configs + connector mgmt
    packages/mcp/        # MCP servers (clickhouse, opensearch, threatintel, soar, rules)
    packages/aegis-core/ # shared Pydantic models, tenant ctx, auth, tracing
    infra/               # docker-compose, k8s/helm, migrations, seeds
    docs/                # spec (already written)
  ```

---

## 1. Agent roster (which Claude Code agent does what)

| Alias | Subagent type | Used for |
|-------|---------------|----------|
| **BUILDER** | `general-purpose` | Primary implementation (multi-file features, services) |
| **AI-ARCH** | `vercel:ai-architect` | Agno/AgentOS/OpenUI/MCP wiring, agent + streaming code |
| **FE** | `general-purpose` (+ `vercel:shadcn`, `vercel:nextjs` skills) | Next.js UI, dashboard, editors |
| **SUPA-FE** | `fullstack-nextjs-supabase-retell` | Supabase Auth + RLS wiring in Next.js (sign-in, sessions, org switch) |
| **SURGEON** | `caveman:cavecrew-builder` | Bounded 1–2 file edits, config tweaks, renames |
| **SCOUT** | `caveman:cavecrew-investigator` / `Explore` | Locate code, map deps before a change |
| **REVIEWER** | `caveman:cavecrew-reviewer` | Review each task's diff before commit |
| **PLANNER** | `Plan` | Break a large task into sub-steps when it's underspecified |

> Isolation: dispatch implementation agents with `isolation: "worktree"` so parallel
> tracks don't collide. Each task's worktree is merged after REVIEWER passes.

---

## 2. Dependency / ordering overview

```
Phase 0  INFRA-*  (repo, compose, CI, migrations base)  ── must land first
   │
   ├── Phase 1 BE-core (aegis-core, auth, tenancy, API skeleton)
   │        │
   │        ├── Phase 2 Data (ClickHouse, OpenSearch, Postgres schema, ingestion)
   │        ├── Phase 3 Rules + Detection runtime
   │        └── Phase 4 Agents (Agno crew, AgentOS, MCP servers)
   │
   └── Phase 1 FE-core (Next.js shell, auth, layout, nav)
            │
            ├── Phase 5 FE feature pages (Rules/Incidents/Cases/Assets/Integrations)
            └── Phase 6 OpenUI chat + generative UI
   Phase 7  SOAR + autonomy + approvals   (needs Agents + FE chat)
   Phase 8  Reports, hunting, billing, hardening
```

---

## 3. The build loop (start implementation)

The loop is deterministic and safe. One iteration = one task fully done.

**Loop procedure (per iteration):**
1. **Select** the topmost `[ ]` task whose deps are all `[x]`. Ties: lower Phase first;
   independent tasks across tracks may run in parallel worktrees.
2. **Dispatch** the task's assigned agent with: the task block, the relevant `docs/` file,
   and "implement to the acceptance criteria; add tests; do not exceed task scope."
3. **Review**: dispatch **REVIEWER** on the resulting diff. If findings → loop the fix
   back to the builder agent until clean.
4. **Verify**: run the task's acceptance check (tests/lint/typecheck/`docker compose up`).
5. **Commit**: one commit per task, message `feat(<track>): <task-id> <title>`.
6. **Mark** the checkbox `[x]` in this file and record the commit hash.
7. **Repeat** until no unblocked `[ ]` remains, or a `[!]` blocker needs a human decision.

**Exit conditions:** all boxes `[x]`, OR a blocker requiring a credential / irreversible
decision (mark `[!]`, stop, surface to user).

**How to run it (choose one):**

- **Self-paced loop (recommended):**
  ```
  /loop implement the next unblocked task in TODO.md following the §3 build-loop
  procedure: dispatch the assigned agent in a worktree, run REVIEWER on the diff,
  verify acceptance, commit, check the box. Stop only when all tasks are [x] or a [!]
  blocker needs my decision.
  ```
- **Fixed interval (e.g. resume every 10 min):** `/loop 10m <same prompt as above>`
- **Manual step:** tell the agent "do the next TODO task" — it runs one iteration.

> Guardrails baked into the loop: worktree isolation, mandatory REVIEWER pass, one-commit-
> per-task, and a hard stop on missing secrets or destructive/irreversible steps.

---

## 4. TRACK A — Architecture / Infra (Phase 0)

- [ ] **INFRA-01** — Scaffold monorepo (`pnpm` workspace + `uv`/`poetry` Python), root
  `README`, `.editorconfig`, `.gitignore`, license. → **BUILDER**. deps: none.
  *Accept:* `pnpm i` and `uv sync` succeed; tree matches §layout.
- [ ] **INFRA-02** — Dev stack: **Supabase CLI** (`supabase init`/`start` → Postgres +
  Auth + Storage) + `infra/docker-compose.yml` for ClickHouse, OpenSearch, Redis, MinIO,
  Vector, Langfuse. Healthchecks + `.env.example`. → **BUILDER**. deps: INFRA-01.
  *Accept:* `supabase start` + `docker compose up` bring all services healthy.
- [ ] **INFRA-03** — `packages/aegis-core`: settings (pydantic-settings), logging,
  OpenTelemetry tracing, tenant-context contextvar, error types. → **BUILDER**.
  deps: INFRA-01. *Accept:* importable; `TenantContext` set/get unit-tested.
- [ ] **INFRA-04** — DB migration harness (Alembic) + ClickHouse migration runner +
  seed scripts. → **BUILDER**. deps: INFRA-02,03. *Accept:* `make migrate` + `make seed`.
- [ ] **INFRA-05** — CI (GitHub Actions): lint (ruff/eslint), typecheck (mypy/tsc),
  tests, build images. → **SURGEON**. deps: INFRA-01. *Accept:* CI green on PR.
- [ ] **INFRA-06** — k8s/Helm chart skeleton (prod topology from [docs/02 §6](docs/02-architecture.md)). → **BUILDER**. deps: INFRA-02. *Accept:* `helm template` renders.
- [ ] **INFRA-07** — Secrets/Vault abstraction (`aegis-core.secrets`) with dev (env) +
  prod (Vault/KMS) backends. → **BUILDER**. deps: INFRA-03. *Accept:* get/put unit-tested.
- [ ] **INFRA-08** — Install **ClickHouse Agent Skills** (`npx skills add
  clickhouse/agent-skills`) into `.claude/skills/`; add **chdb** local backend + the
  `aegis-core.storage` abstraction (`STORAGE_BACKEND=local`, `CLICKHOUSE_BACKEND=chdb`) —
  **no S3 locally**. See [docs/10](docs/10-external-tools.md). → **BUILDER**. deps: INFRA-03.
  *Accept:* skills present; core selects chdb + local `./data` storage from env; unit tests.

## 5. TRACK B — Backend (FastAPI BFF + services)

### Phase 1 — Core
- [ ] **BE-01** — FastAPI app skeleton in `apps/api` (routers, deps, OpenAPI, healthz,
  CORS, error handlers). → **BUILDER**. deps: INFRA-03. *Accept:* `/healthz` 200; OpenAPI.
- [ ] **BE-02** — **Supabase** schema + **RLS** (tenants, users, roles, memberships,
  api_keys, audit_log) via Supabase migrations; RLS policies read `auth.jwt()->>'tenant_id'`.
  Per [docs/07](docs/07-data-model-and-api.md). → **BUILDER**. deps: INFRA-04.
  *Accept:* migration applies; RLS blocks cross-tenant read for a second tenant's JWT (test).
- [ ] **BE-03** — Auth: **Supabase Auth** — verify the Supabase JWT in FastAPI (JWKS/
  `SUPABASE_JWT_SECRET`), `require_user` + `require_tenant` deps (tenant/role from claims),
  RBAC permission checks. See [docs/05](docs/05-auth-and-integrations.md). → **BUILDER**.
  deps: BE-01,02. *Accept:* protected route rejects anon; wrong-tenant token blocked.
- [ ] **BE-04** — Tenant middleware: read `tenant_id` from the Supabase JWT and set
  `app.current_tenant` on the service PG session per request. → **SURGEON**. deps: BE-03.
  *Accept:* isolation integration test green.
- [ ] **BE-05** — Enterprise **SSO (Supabase SAML)** + **SCIM** provisioning wiring; map
  SSO/SCIM users → tenant + role claims. → **BUILDER**. deps: BE-03. *Accept:* SCIM
  create/deactivate user; SAML sign-in yields a tenant-scoped session.

### Phase 2 — Data plane
- [ ] **BE-06** — ClickHouse schema: `events`, `detections`, `event_archive_ref` with
  `tenant_id` + row policies per [docs/04](docs/04-data-and-tenancy.md); must run on
  **chdb** (local) and server (use the ClickHouse Agent Skills). → **BUILDER**.
  deps: INFRA-04,08. *Accept:* insert+query tenant-scoped; row policy blocks cross-tenant.
- [ ] **BE-07** — OpenSearch index templates `t-{tenant}-*` + DLS + federation client
  (Splunk/Elastic/Sentinel adapters). → **BUILDER**. deps: INFRA-02. *Accept:* per-tenant
  index isolation test; federated query returns normalized rows.
- [ ] **BE-08** — Ingestion service: manage Vector pipelines + connector CRUD + secrets +
  health. Connectors: AWS/Azure/GCP/K8s/Cloudflare/Docker/Datadog/Okta/Syslog/HTTP/S3/Kafka.
  → **BUILDER**. deps: BE-01, INFRA-07. *Accept:* add connector → Vector config emitted →
  sample events land in ClickHouse.
- [ ] **BE-09** — VRL normalization to ECS (per-source transforms) + schema tests. →
  **BUILDER**. deps: BE-08. *Accept:* golden-file tests map raw→ECS for each source.

### Phase 3 — Rules + detection
- [ ] **BE-10** — Rules CRUD + versioning + folders + tags + Sigma import, YAML schema
  validation per [docs/06](docs/06-detection-engine.md). → **BUILDER**. deps: BE-02.
  *Accept:* create/update/version rule; invalid YAML rejected; Sigma import works.
- [ ] **BE-11** — Rule compilers: YAML → ClickHouse SQL / OpenSearch DSL / Spark / Python.
  6 rule types (Query/Threshold/SourceMonitor/ThreatMatch/Code/Spark). → **BUILDER**.
  deps: BE-06,10. *Accept:* each type compiles + runs on sample data with expected hits.
- [ ] **BE-12** — Detection scheduler (per-tenant, per-`frequency`, over `depth`) +
  backtest endpoint. → **BUILDER**. deps: BE-11. *Accept:* enabled rule fires on schedule;
  backtest returns historical matches < 10s on 30d sample.
- [ ] **BE-13** — Correlation → Incidents; Incidents + Cases CRUD, assignment, status,
  SLA timers, comments. → **BUILDER**. deps: BE-12. *Accept:* correlated detections form
  an incident; promote to case; status transitions audited.
- [ ] **BE-14** — Assets/entities inventory + risk scoring + entity pages API. →
  **BUILDER**. deps: BE-02. *Accept:* upsert asset; entity page returns detections+cases.

### Phase 4 — SOAR
- [ ] **BE-15** — SOAR action library (notify/enrich/block_ip/isolate_host/disable_user/
  ticket/run_script) + playbook engine (triggers/conditions/actions/approvals). →
  **BUILDER**. deps: BE-13, AI-04. *Accept:* playbook runs; destructive action requires
  approval; run history + rollback where possible.
- [ ] **BE-16** — Autonomy policy engine (per tenant × action-class: auto/approve/deny) +
  kill-switch + token/step budgets. → **BUILDER**. deps: BE-15. *Accept:* policy gates
  action execution; kill-switch flips all to deny.

## 6. TRACK C — Frontend (Next.js 16 + OpenUI)

### Phase 1 — Shell
- [ ] **FE-01** — `apps/web` Next.js 16 App Router + Tailwind + shadcn/ui init; theme
  (light/dark), layout, left nav (Dashboard/Rules/Incidents/Cases/Assets/Automation/
  Investigations/Reports/AI Assistant + Manage). → **FE**. deps: INFRA-01. *Accept:* nav
  renders; routes stubbed; matches teardown IA.
- [ ] **FE-02** — **Supabase Auth** (`@supabase/ssr`): sign-in/up, cookie sessions,
  `middleware.ts` refresh, org switcher, protected layouts, RBAC-aware nav. → **SUPA-FE**.
  deps: FE-01, BE-03. *Accept:* login sets session cookie; tenant switch reloads scoped data.
- [ ] **FE-03** — API client (typed from OpenAPI) + TanStack Query + WS/SSE live feed. →
  **FE**. deps: FE-01, BE-01. *Accept:* typed calls; live case updates stream.

### Phase 5 — Feature pages
- [ ] **FE-04** — Rules list (table + grid toggle, search, columns, filter, pagination) +
  rule-type modal (6 types). → **FE**. deps: FE-03, BE-10. *Accept:* matches teardown §3.6.
- [ ] **FE-05** — Rule editor: Monaco YAML split view + Details/Folders/Upload/Assistant
  tabs; Save/Duplicate/Disable/Delete; YAML schema lint. → **FE**. deps: FE-04. *Accept:*
  edit+save round-trips; schema errors inline.
- [ ] **FE-06** — Incidents page (cards: severity rail, detection details, assignee,
  status, tags; search/filter). → **FE**. deps: FE-03, BE-13. *Accept:* matches §3.3.
- [ ] **FE-07** — Cases page (CASE-IDs, status, assignee, tags, detail view + timeline +
  comments + evidence). → **FE**. deps: FE-03, BE-13. *Accept:* matches §3.4.
- [ ] **FE-08** — Assets + entity pages (risk, related detections/cases). → **FE**.
  deps: FE-03, BE-14.
- [ ] **FE-09** — Integrations hub (stats, tabs, connector cards Connected/Disconnected/
  Error, Configure, + Add Integration). → **FE**. deps: FE-03, BE-08. *Accept:* matches §3.2.
- [ ] **FE-10** — Automation/SOAR UI (playbook builder visual+code, action library,
  approval queue, run history). → **FE**. deps: FE-03, BE-15,16.
- [ ] **FE-11** — Investigations/hunting workspace (KQL/SQL query, results, entity pivot,
  timeline, saved hunts). → **FE**. deps: FE-03, BE-07.
- [ ] **FE-12** — Reports & dashboards (MTTD/MTTR, FP rate, coverage vs MITRE, exec PDF).
  → **FE**. deps: FE-03, BE-18.
- [ ] **FE-13** — Admin/Settings (users, roles, API keys, SSO/SCIM, tenants, retention,
  billing/quotas). → **FE**. deps: FE-02, BE-05.

### Phase 6 — Generative UI chat
- [ ] **FE-14** — Scaffold OpenUI (`pnpx @openuidev/cli create`) or add
  `@openuidev/react-{lang,headless,ui}`; wire `ChatProvider`. See [docs/09](docs/09-chat-generative-ui.md). → **AI-ARCH**. deps: FE-01. *Accept:* chat renders + streams from a mock.
- [ ] **FE-15** — Aegis GenUI component library (AlertCard, MitreMappingTable,
  InvestigationTimeline, RuleDiff, ApprovalPrompt, EntityCard, MetricTile, CaseCard) with
  Zod props; generate system prompt. → **AI-ARCH**. deps: FE-14. *Accept:* each component
  renders from OpenUI Lang; prompt generated by CLI.
- [ ] **FE-16** — BFF stream proxy `/api/assistant/stream` (inject tenant JWT) ↔ AgentOS
  streaming adapter; wire HITL ApprovalPrompt → approvals endpoint. → **AI-ARCH**.
  deps: FE-15, AI-03. *Accept:* real Argus run streams into chat; approve/deny resumes run.

## 7. TRACK D — Agents / AI (Agno + AgentOS + MCP)

- [ ] **AI-01** — Agent tool layer: **adopt `opensearch-agent-server`** (`--with-mcp`,
  :8001) for OpenSearch (wrap with tenant guard); build `mcp-clickhouse` (chdb/server),
  `mcp-threatintel`, `mcp-soar`, `mcp-rules` (tenant-scoped via bearer/tenant header).
  See [docs/03 §7](docs/03-agents.md), [docs/10](docs/10-external-tools.md). → **AI-ARCH**.
  deps: BE-06,07,10. *Accept:* each tool source lists tools; per-tenant scope enforced.
- [ ] **AI-02** — Agno agents (Triage/Investigation/ThreatIntel/Response/DetectionEng/
  Reporting) with model tiers, tools, `tool_hooks` (audit + tenant guard). → **AI-ARCH**.
  deps: AI-01. *Accept:* each agent runs a scripted scenario; hooks log every call.
- [ ] **AI-03** — Argus `Team` (supervisor) + `Workflow` (Router/Loop/Condition) incident
  pipeline + guardrails (PromptInjection/PII). See [docs/03 §4–5](docs/03-agents.md). →
  **AI-ARCH**. deps: AI-02. *Accept:* end-to-end incident → narrative+MITRE+recommendation
  on a golden incident; loop caps at `max_iterations`.
- [ ] **AI-04** — HITL approval: `requires_confirmation` destructive tools; pause →
  `active_requirements` → `confirm/reject` → `continue_run`. → **AI-ARCH**. deps: AI-03.
  *Accept:* isolate_host pauses; resume executes; audit recorded.
- [ ] **AI-05** — AgentOS runtime: `AgentOS(agents,teams,workflows,db).get_app()` on :7777,
  JWT+RBAC mapped to Aegis tenants; mount beside BFF. → **AI-ARCH**. deps: AI-03.
  *Accept:* control plane connects; runs/sessions/approvals REST endpoints work per tenant.
- [ ] **AI-06** — Detection-Engineering agent powers Vibe assistant (NL→rule YAML→backtest)
  + coverage-gap proposals. → **AI-ARCH**. deps: AI-02, BE-11. *Accept:* NL prompt yields
  valid rule that compiles + backtests.
- [ ] **AI-07** — Memory + knowledge (RAG, pgvector, per-tenant namespaces) for agents. →
  **AI-ARCH**. deps: AI-02. *Accept:* agent recalls prior verdict; no cross-tenant retrieval.
- [ ] **AI-08** — Langfuse tracing + agent evals in CI (golden incidents, false-auto-close
  rate). → **AI-ARCH**. deps: AI-03, INFRA-05. *Accept:* traces visible; eval gate in CI.

## 8. TRACK E — Cross-cutting (Phase 8 hardening)

- [ ] **SEC-01** — Automated tenant-isolation test suite (PG RLS + CH row policy + OS DLS +
  API + agent tool guard). → **REVIEWER**+**BUILDER**. deps: BE-04, AI-02.
- [ ] **SEC-02** — Immutable, hash-chained audit log for all user + agent actions. →
  **BUILDER**. deps: BE-02.
- [ ] **BE-17** — API keys (tenant-scoped, scoped perms) + webhooks + rate limiting. →
  **BUILDER**. deps: BE-03.
- [ ] **BE-18** — Metrics rollups (MTTD/MTTR/FP/coverage) + reporting/exec PDF service. →
  **BUILDER**. deps: BE-13.
- [ ] **BE-19** — Billing/quotas (ingest GB, agent token budget, seats) + metering. →
  **BUILDER**. deps: BE-16.
- [ ] **OPS-01** — Load test ingest (10k eps/tenant) + detection query p95 < 10s. →
  **BUILDER**. deps: BE-12.
- [ ] **OPS-02** — Threat-model review + pen-test checklist + secret-scan in CI. →
  **REVIEWER**. deps: most BE/AI.

---

## 9. Progress log
_(loop appends: `<task-id> — <commit hash> — <date>`)_
