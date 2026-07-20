# 01 — Product Requirements Document (PRD): Aegis

Status: v1 draft · Owner: Founding team · Audience: eng, design, GTM.

---

## 1. Vision

> Give every security team an **autonomous SOC** that detects, investigates, and responds
> to threats as *code + AI agents* — running on their own data, at a fraction of legacy
> SIEM cost, with the analyst always in control of consequential actions.

Aegis is an **AI-native Open XDR platform**. Detections, enrichments, and response
playbooks are versioned artifacts. A crew of autonomous LLM agents (Argus) operates the
alert lifecycle 24/7. Data lives in the customer's analytics store (ClickHouse) or is
federated from existing SIEMs (OpenSearch, Splunk, Elastic, Sentinel). The platform is
multi-tenant SaaS with hard isolation, enterprise SSO, and a full audit trail.

## 2. Problem statement

- **Alert overload:** analysts drown in low-context alerts; MTTD/MTTR stay high.
- **SIEM cost & lock-in:** legacy SIEM licensing (per-GB ingest) is punishing at scale.
- **Tribal detection knowledge:** rules live in vendor UIs, untested, unversioned.
- **Manual response:** containment is slow, inconsistent, and error-prone.
- **AI hype without governance:** autonomous action without approval gates is unsafe.

## 3. Goals & non-goals

### Goals (v1 → v2)
1. Detection-as-code with 6 rule types, CI-testable, Git-syncable.
2. Autonomous multi-agent triage → investigation → response with HITL gates.
3. ClickHouse-native analytics + OpenSearch/other SIEM federation.
4. Multi-tenant SaaS: hard isolation, SSO/SCIM, RBAC, per-tenant keys & quotas.
5. SOAR playbooks (notify / enrich / block / isolate / disable account).
6. Incidents + Cases workflow with MITRE ATT&CK mapping and reporting.

### Non-goals (explicitly out of scope for v1)
- Being an EDR sensor/agent on endpoints (we *consume* EDR telemetry, not replace it).
- Building our own threat-intel feeds (we integrate MISP/OTX/VT/AbuseIPDB).
- Full GRC/compliance management suite (we export evidence, not run audits).
- On-prem air-gapped install (v1 is SaaS + BYO-datastore; air-gap is later).

## 4. Personas

| Persona | Role | Primary jobs-to-be-done |
|---------|------|-------------------------|
| **Priya — SOC Analyst (Tier 1/2)** | Triage & investigate | Understand alerts fast, see agent findings, approve/deny actions, work cases |
| **Diego — Detection Engineer** | Author detections | Write/test/tune rules as code, use AI assistant, manage coverage |
| **Sara — SOC Manager** | Run the SOC | Metrics (MTTD/MTTR), coverage, staffing, reports, agent oversight |
| **Ravi — Security Engineer / Admin** | Operate platform | Integrations, data sources, SSO, RBAC, tenants, API keys |
| **Mina — CISO** | Executive | Risk posture, exec reports, ROI, audit/compliance evidence |
| **Argus — the agent crew** | Autonomous operator | Do the Tier-1/Tier-2 work under policy, escalate what it can't |

## 5. Feature epics (with user stories & acceptance criteria)

### EPIC A — Detection Engineering ("Detection as Code")
- **A1. Rule authoring (6 types):** Query, Threshold, Source Monitor, Threat Match,
  Code (Python), Spark (Lucene+Spark). YAML source + form editor, split view.
- **A2. Rule metadata:** title, rule_id (UUID), severity, version, confidence, maturity,
  capabilities, MITRE tags, author, dates, description, note, integration, indices,
  frequency, depth, timestamp_override, exclusions, enabled, learning_mode.
- **A3. AI Rule Assistant ("Vibe Detection"):** NL prompt → generated rule YAML → preview
  → **Apply to editor**. Explains the logic; suggests tests.
- **A4. Rule lifecycle:** enable/disable, duplicate, delete, version history, folders.
- **A5. Rule testing:** dry-run against historical data (backtest), unit tests, coverage
  view mapped to MITRE ATT&CK matrix.
- **A6. Import/Sync:** upload rules, import **Sigma** rules, optional Git sync.

> **Story (Diego):** "As a detection engineer, I write a threshold rule in YAML, backtest
> it against last 30 days in ClickHouse, see 3 historical hits, tune the threshold, and
> enable it — all in one screen."
> **Accept:** rule saved with version bump; backtest returns row-level matches with
> latency < 10s on 30d window; enabling schedules it on the given `frequency`.

### EPIC B — Ingestion & Data Plane
- **B1. Connectors** (parity + superset with Vinci): AWS (CloudTrail, GuardDuty,
  SecurityHub), Azure (Defender/Monitor), GCP (SCC), Kubernetes, Cloudflare, Docker,
  Datadog, Okta, plus generic Syslog/HTTP/S3/Kafka.
- **B2. Normalization to ECS** (Elastic Common Schema-like) via Vector VRL transforms.
- **B3. Dual sink:** raw → object store (archive), normalized → ClickHouse (hot detect),
  optional → OpenSearch (search/federation).
- **B4. Integrations hub UI:** status (Connected/Disconnected/Error), Configure, Add,
  health metrics, per-tenant credentials in a secrets vault.
- **B5. Federated search:** query external SIEMs (OpenSearch/Splunk/Elastic/Sentinel)
  without ingesting — "detect where the data lives."

### EPIC C — Detection Runtime
- **C1. Scheduler** runs enabled rules on `frequency`, over `depth` window, per tenant.
- **C2. Compilers:** YAML rule → ClickHouse SQL / OpenSearch DSL / Spark job / Python.
- **C3. Deduplication & correlation:** cluster related detections into **Incidents**.
- **C4. Enrichment pipeline:** asset context, identity context, GeoIP, threat intel.
- **C5. Learning mode:** rule runs without alerting to gather baseline/tune thresholds.

### EPIC D — Autonomous SOC Agents (Argus) — see [03-agents](03-agents.md)
- **D1. Triage agent:** dedup, correlate, score, decide auto-close vs escalate.
- **D2. Investigation agent:** enrich, query SIEM/ClickHouse, build attack narrative,
  MITRE mapping, timeline, blast-radius.
- **D3. Threat-intel agent:** IOC reputation (VT/AbuseIPDB/OTX/MISP).
- **D4. Response agent:** execute SOAR playbooks — **destructive actions require approval
  hook** (PreToolUse) unless tenant policy grants autonomy for that action class.
- **D5. Detection-engineering agent:** power the Vibe assistant, propose new rules from
  gaps and false-negative reviews.
- **D6. Reporting agent:** generate case reports, exec summaries.
- **D7. Supervisor/orchestrator:** route work, manage the autonomous loop, enforce budget.
- **D8. Governance:** every tool call logged (PostToolUse), full trace + replay, policy
  engine controls autonomy per action class per tenant.

> **Story (Priya):** "An 'Impossible Travel' alert fires. Argus auto-triages (severity
> medium, not a false positive), enriches both logins, finds the German IP is a known
> VPN + the US login used a corporate device, drafts a narrative, and recommends
> 'suspend session + require re-MFA'. I click **Approve**; Argus executes via Okta and
> writes the case."
> **Accept:** agent produces narrative + MITRE mapping + recommended action within SLA;
> destructive step blocked pending my approval; full trace visible; action executed and
> logged on approve.

### EPIC E — Incidents & Cases
- **E1. Incidents:** auto-created from correlated detections; fields per teardown §3.3.
- **E2. Cases:** promote incident to case; assignment, status (Open/In Progress/Closed),
  notes, evidence, timeline, linked entities, SLA timers.
- **E3. Collaboration:** comments, @mentions, activity log, attachments.
- **E4. Bidirectional sync:** optional push to Jira/ServiceNow/Slack/Teams.

### EPIC F — Assets & Entities
- **F1. Inventory:** hosts, users, cloud resources, identities; source-of-truth merge.
- **F2. Entity pages:** risk score, recent detections, related cases, timeline.
- **F3. Criticality tags** feed severity scoring.

### EPIC G — SOAR / Automation
- **G1. Playbook builder** (visual + code): triggers, conditions, actions, approvals.
- **G2. Action library:** notify (Slack/Teams/email/PagerDuty), enrich, block IP
  (firewall/Cloudflare), isolate host (EDR), disable/suspend user (Okta/AzureAD/AD),
  create ticket, run script.
- **G3. Approval gates & autonomy policy** per action class per tenant.
- **G4. Playbook runs:** history, status, rollback where possible.

### EPIC H — Investigations / Threat Hunting
- **H1. Ad-hoc query workspace** (KQL/Lucene + SQL) over ClickHouse/OpenSearch.
- **H2. Saved hunts**, scheduled hunts, notebook-style investigations.
- **H3. Entity pivoting & timeline visualization.**

### EPIC I — Reports & Analytics
- **I1. Operational metrics:** MTTD, MTTR, alert volume, FP rate, agent auto-resolve %,
  coverage vs MITRE.
- **I2. Dashboards** (per role) + scheduled exec reports (PDF/email).
- **I3. Per-case report** generated by the reporting agent.

### EPIC J — Global AI Assistant
- **J1. Chat** to explain alerts/rules/entities, answer "what happened", draft queries.
- **J2. Context-aware:** scoped to current tenant + RBAC of the user; grounded in the
  tenant's own data (RAG over cases/rules/telemetry).

### EPIC K — Platform / Admin (see [05-auth-and-integrations](05-auth-and-integrations.md))
- **K1. Multi-tenant orgs, workspaces, invites.**
- **K2. Auth:** OIDC + SAML SSO, SCIM provisioning, MFA.
- **K3. RBAC:** roles (Admin, Manager, Detection Eng, Analyst, Read-only, Agent) +
  fine-grained permissions.
- **K4. API keys** (tenant-scoped, scoped permissions), webhooks.
- **K5. Audit log** (immutable) of every user + agent action.
- **K6. Billing/quotas:** ingest volume, agent token budget, seats.
- **K7. Data residency & retention** config per tenant.

## 6. Cross-cutting requirements (NFRs)

| Area | Requirement |
|------|-------------|
| **Tenant isolation** | No cross-tenant read/write path; enforced at DB (RLS), analytics (row policies), search (DLS), and API (tenant-scoped tokens). Verified by automated isolation tests. |
| **Security** | Encryption in transit (TLS) + at rest; secrets in vault; least-privilege connectors; SOC2-ready audit trail. |
| **Agent safety** | Destructive actions gated by policy + human approval by default; every tool call logged; kill-switch per tenant; token/step budgets. |
| **Performance** | Detection query p95 < 10s on 30-day window (ClickHouse); UI TTFB < 500ms; agent triage < 60s median. |
| **Scale** | 10k+ events/sec/tenant ingest; 100s of concurrent rules; horizontal workers. |
| **Availability** | 99.9% API; detection runtime resumable (durable scheduler + checkpointed agent loops). |
| **Observability** | OTel traces across API→runtime→agents; Langfuse for LLM runs; per-tenant usage metering. |
| **Compliance** | GDPR data handling, configurable retention, audit export, PII redaction option in agent prompts. |

## 7. Success metrics (North Star + supporting)

- **North Star:** % of alerts auto-resolved correctly by Argus without human touch
  (target: 40% by v2), while **false-auto-close rate < 1%**.
- MTTD / MTTR reduction vs. baseline.
- Detection coverage (MITRE techniques with ≥1 active rule).
- Analyst time saved / week.
- Ingest cost per GB vs. legacy SIEM.

## 8. Release phases (summary — full plan in [08-roadmap](08-roadmap.md))

- **Phase 0 (Foundations):** tenancy, auth, data plane (ClickHouse + Vector), rules CRUD.
- **Phase 1 (Detect):** detection runtime, incidents, integrations hub, OpenSearch fed.
- **Phase 2 (Investigate):** Argus triage + investigation agents, cases, AI assistant.
- **Phase 3 (Respond):** SOAR, response agent + approval hooks, autonomy policy.
- **Phase 4 (Scale):** reports, hunting, Sigma import, billing, marketplace connectors.
