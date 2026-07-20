# Aegis — AI-Native Open XDR & Autonomous SOC Platform

> Working codename: **Aegis** (platform) · **Argus** (autonomous SOC agent crew).
> Both names are placeholders — rename freely.

Aegis is a multi-tenant, AI-native Security Operations platform built around three ideas:

1. **Detection & Response as Code** — every detection rule, enrichment, and response
   playbook is a versioned artifact (YAML / Python), reviewable in Git, testable in CI.
2. **Open XDR data plane** — detection runs *where the data lives*. ClickHouse is the
   primary analytics datalake; OpenSearch (and other SIEMs) plug in as federated sources.
3. **Autonomous multi-agent SOC** — a crew of LLM agents (built on **Agno**, served by
   **AgentOS**, using **Claude** models + **MCP** tools) that triage, investigate, and
   respond to alerts end-to-end, with human-in-the-loop gates on anything destructive.
   The chat surface is **generative UI** via **OpenUI**.

This repository currently holds the **product + technical specification**. Implementation
follows the architecture defined in [`docs/`](docs/).

---

## What this replaces / competes with

Aegis is a clean-room reimagining of the **Vinci Logic** SaaS (see the competitive
teardown in [docs/00-competitive-analysis.md](docs/00-competitive-analysis.md)) with a
superset of features and several deliberate upgrades:

| Capability                     | Vinci Logic | Aegis |
|--------------------------------|:-----------:|:-----:|
| Detection-as-code (YAML rules) | ✅ | ✅ |
| AI SOC agent (single)          | ✅ (AvicennAI) | ✅ **multi-agent crew (Argus)** |
| SOAR / response playbooks      | ✅ | ✅ + policy-gated autonomous execution |
| ClickHouse + OpenSearch        | ✅ | ✅ (ClickHouse = primary, OpenSearch federated) |
| Cloud/SaaS integrations        | ✅ | ✅ (Vector-based ingestion pipeline) |
| Multi-tenant                   | ~ (single org shown) | ✅ **hard tenant isolation (RLS + row policies)** |
| Auth / SSO / RBAC              | basic | ✅ **OIDC + SAML + SCIM + fine-grained RBAC** |
| Agent hooks / autonomous loop  | opaque | ✅ **explicit PreToolUse/PostToolUse hooks, durable loop** |

---

## Documentation map

| Doc | Contents |
|-----|----------|
| [00 — Competitive Analysis](docs/00-competitive-analysis.md) | Full feature extraction of Vinci Logic from the product screenshots |
| [01 — Product Requirements (PRD)](docs/01-prd.md) | Vision, personas, feature epics, user stories, acceptance criteria |
| [02 — System Architecture](docs/02-architecture.md) | Services, tech stack, deployment topology, data flow |
| [03 — Multi-Agent System](docs/03-agents.md) | Framework decision, agent crew, tools, hooks, autonomous loop |
| [04 — Data & Multi-Tenancy](docs/04-data-and-tenancy.md) | ClickHouse, OpenSearch, Postgres, tenant isolation model |
| [05 — Auth & Integrations](docs/05-auth-and-integrations.md) | AuthN/Z, SSO, SCIM, SIEM connectors, ingestion |
| [06 — Detection Engine](docs/06-detection-engine.md) | Rule types, YAML schema, compilation targets |
| [07 — Data Model & API](docs/07-data-model-and-api.md) | Postgres schema, ClickHouse tables, REST/WS API surface |
| [08 — Roadmap & Delivery](docs/08-roadmap.md) | Phased build plan, milestones, non-goals |
| [09 — Chat & Generative UI](docs/09-chat-generative-ui.md) | OpenUI generative-UI chat, component library, AgentOS binding |
| [10 — External Tools](docs/10-external-tools.md) | OpenSearch Agent Server + ClickHouse Agent Skills + local-first (no S3) |

---

## Reference tech stack (summary)

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 16 (App Router) + React + TypeScript + Tailwind + shadcn/ui | Matches the polished dashboard UX; SSR + streaming |
| Chat / Generative UI | **OpenUI** (`@openuidev/*`, OpenUI Lang) | Agents reply with streamed, safe, interactive UI (alert cards, MITRE tables, approvals) |
| API / BFF | FastAPI (Python 3.13) | Same runtime as agents; typed, async, OpenAPI-native |
| Agents | **Agno** (tools, hooks, teams, Workflows loops, HITL) + **AgentOS** runtime | All agent primitives native; self-hosted runtime + control plane + 80+ REST endpoints |
| LLM | Claude (Fable 5 / Opus 4.8 / Sonnet 5 / Haiku 4.5) via Anthropic API, tools via **MCP** | Best-in-class agentic reasoning + tool use; model-tiered by cost |
| Analytics datalake | **ClickHouse** — **chdb** (in-process, local) in dev, server in prod | Columnar, SIEM-scale event storage + detection SQL; zero-infra local dev |
| Search / federated SIEM | **OpenSearch** + **opensearch-agent-server** (`--with-mcp`) (+ Splunk/Elastic/Sentinel connectors) | Full-text, correlation, agent MCP tool layer, "detect where data lives" |
| App metadata DB + Auth | **Supabase** (managed Postgres + **RLS** + **Supabase Auth**) | Tenants, users, rules, cases, incidents, config; auth + RLS in one layer |
| Ingestion | **Vector** + Redpanda/Kafka | Vendor-neutral log collection → normalization → sink |
| Cache / queue | Redis | Sessions, rate limits, hot cache, light queues |
| Durable workflows | Agno Workflows 2.0 + AgentOS `PostgresDb` (Temporal optional at scale) | Long-running investigations, retries, HITL waits, resumable paused runs |
| Object store | **Local filesystem `./data`** (dev, no S3) → Supabase Storage / S3 (prod) | Raw log archive, case artifacts, generated reports |
| Auth | **Supabase Auth** (email/OAuth/MFA; SAML SSO + SCIM on Pro) | B2B orgs via tenant claims in the JWT; drives Postgres RLS |
| LLM observability | Langfuse + OpenTelemetry | Traces, cost, evals for agent runs |

Full rationale in [docs/02-architecture.md](docs/02-architecture.md) and
[docs/03-agents.md](docs/03-agents.md).
