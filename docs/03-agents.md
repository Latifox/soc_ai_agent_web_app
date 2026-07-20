# 03 — Multi-Agent System (Argus) — built on Agno

> Framework decision: **Agno** (agno-agi) is the agent framework for Aegis. It provides,
> in one Python library, every primitive the goal requires — tools + function calling,
> **hooks** (pre/post + tool hooks), **loops** (Workflows 2.0), **multi-agent teams**,
> **human-in-the-loop** approval, memory/knowledge (RAG), durable session storage, MCP,
> and a self-hosted runtime + control plane (**AgentOS**). Docs: https://docs.agno.com/

## 1. Why Agno (framework decision)

The goal asked for a framework with *tools, function calling, hooks, loops, autonomous
multi-agent operation*. Mapping the requirement to primitives:

| Requirement | Agno primitive |
|-------------|----------------|
| Tools / function calling | Python functions + Toolkits; typed args; `@tool` decorator |
| **Hooks** | `tool_hooks` (wrap every tool call), `@tool(pre_hook=, post_hook=)`, Agent/Team `pre_hooks`/`post_hooks` |
| **Loop** | Workflows 2.0 `Loop(steps, end_condition, max_iterations)` |
| Autonomous multi-agent | `Team(members=[...])` — leader delegates to member agents |
| Human-in-the-loop / approval gate | `@tool(requires_confirmation=True)` → run pauses → `confirm()/reject()` → `continue_run()` |
| Guardrails | `PromptInjectionGuardrail`, `PIIDetectionGuardrail`, custom, via `pre_hooks` |
| Durability / state | `PostgresDb` sessions + memory; Workflow session state |
| Tool ecosystem | `MCPTools` / `MultiMCPTools` (connect our SIEM/ClickHouse/TI/SOAR MCP servers) |
| Runtime + API + monitoring | **AgentOS** — self-hosted FastAPI app (`.get_app()`), 80+ REST endpoints, control plane, JWT+RBAC |
| Observability | Built-in session metrics + OpenTelemetry → Langfuse |

**Why Agno over the alternatives** (all considered):

| Framework | Verdict for Aegis |
|-----------|-------------------|
| **Agno** ✅ chosen | All primitives native; **AgentOS = production runtime + control plane out of the box**; fast/low-memory agent instantiation; model-agnostic (Claude); MCP-native; self-hosted, data stays in our DB |
| CrewAI | Good role/crew ergonomics but weaker on production runtime, hooks, and durable HITL; user explicitly chose Agno instead |
| LangGraph | Excellent durable graphs, but lower-level; we'd rebuild serving/RBAC/UI that AgentOS gives free |
| Claude Agent SDK | Great single-agent loop + hooks, but multi-agent orchestration + serving layer is DIY |
| OpenAI Agents SDK / AutoGen | Solid, but less batteries-included for a self-hosted SOC control plane |

Model provider stays **Claude** (via `agno.models.anthropic.Claude`) — Agno is
model-agnostic, we default to the strongest Claude models per task tier.

## 2. Model tiering (cost/latency vs. reasoning)

| Tier | Model id | Used by |
|------|----------|---------|
| Heavy reasoning | `claude-fable-5` (or `claude-opus-4-8`) | Investigation, detection-engineering, supervisor planning |
| Balanced | `claude-sonnet-5` | Response drafting, reporting |
| Cheap/fast | `claude-haiku-4-5-20251001` | Triage classification, dedup, guardrail checks, enrichment glue |

```python
from agno.models.anthropic import Claude
REASONER  = Claude(id="claude-fable-5")
BALANCED  = Claude(id="claude-sonnet-5")
FAST      = Claude(id="claude-haiku-4-5-20251001")
```

## 3. The Argus crew (agents)

Each agent = an Agno `Agent` with a role, a scoped toolset (MCP + native), instructions,
model tier, and tenant-scoped memory/knowledge.

| Agent | Role | Key tools |
|-------|------|-----------|
| **Triage** (FAST) | Dedup, correlate, score, decide auto-close vs escalate | `clickhouse.query`, `incidents.get`, `assets.lookup` |
| **Investigation** (REASONER) | Enrich, query telemetry, build attack narrative + MITRE map + timeline + blast radius | `clickhouse.query`, `opensearch.search`, `siem.federated_query`, `assets.context`, `identity.context`, `mitre.map` |
| **Threat-Intel** (FAST) | IOC reputation & context | `ti.virustotal`, `ti.abuseipdb`, `ti.otx`, `ti.misp` |
| **Response** (BALANCED) | Propose + execute SOAR playbooks (destructive = confirmation-gated) | `soar.notify`, `soar.block_ip`, `soar.isolate_host` ⚠, `soar.disable_user` ⚠, `soar.create_ticket` |
| **Detection-Engineering** (REASONER) | Power the Vibe assistant; generate/tune rules; propose coverage from gaps | `rules.search`, `rules.backtest`, `rules.validate`, `sigma.import`, `clickhouse.query` |
| **Reporting** (BALANCED) | Case reports, exec summaries | `cases.get`, `metrics.query`, `report.render` |
| **Supervisor / Team leader** (REASONER) | Route work, run the loop, enforce budget/policy | delegates to members |

⚠ = destructive → `requires_confirmation=True` unless tenant autonomy policy pre-approves.

```python
from agno.agent import Agent
from agno.db.postgres import PostgresDb

db = PostgresDb(db_url=SETTINGS.pg_url)  # sessions, memory, metrics — per-tenant scoped

triage = Agent(
    name="Triage",
    role="Deduplicate, correlate and score incidents; decide auto-close vs escalate.",
    model=FAST,
    tools=[clickhouse_mcp, incidents_tools, assets_tools],
    db=db,
    instructions=TRIAGE_INSTRUCTIONS,
    tool_hooks=[audit_hook, tenant_guard_hook],   # governance on every call
)

investigation = Agent(
    name="Investigation",
    role="Enrich alerts, query telemetry, build a MITRE-mapped attack narrative.",
    model=REASONER,
    tools=[clickhouse_mcp, opensearch_mcp, siem_fed_mcp, ti_mcp, assets_tools, mitre_tools],
    db=db,
    add_history_to_context=True,
    markdown=True,
    tool_hooks=[audit_hook, tenant_guard_hook],
)
# … threat_intel, response, detection_eng, reporting defined the same way
```

## 4. Team topology (multi-agent)

The **Supervisor** is an Agno `Team` whose leader delegates to member agents. The leader
plans, decides whether to answer directly or delegate, members run (concurrently where
independent), leader synthesizes.

```python
from agno.team import Team

argus = Team(
    name="Argus SOC",
    model=REASONER,                     # team leader / planner
    members=[triage, investigation, threat_intel, response, detection_eng, reporting],
    db=db,
    instructions=SUPERVISOR_INSTRUCTIONS,
    pre_hooks=[PromptInjectionGuardrail(), PIIDetectionGuardrail(), tenant_context_hook],
    post_hooks=[output_policy_hook],
    add_history_to_context=True,
)
```

- **Shared context:** members share session state (incident id, tenant, findings so far),
  conversation history, memories.
- **Interactive chat** (global AI Assistant) also runs through `argus` — the same crew
  answers "explain this alert" and drives autonomous incident handling.

## 5. Autonomous loop (Workflows 2.0)

Autonomy is a **deterministic pipeline with a bounded loop**, not an open-ended "run
forever." An incident enters the workflow; the crew iterates enrich→assess until the case
is decided or escalated; destructive response steps are confirmation-gated.

```python
from agno.workflow import Workflow, Step, Loop, Condition, Router

incident_response = Workflow(
    name="Incident Response",
    db=db,
    steps=[
        Step(name="triage", team=argus, ...),          # or agent=triage
        Router(                                          # branch on triage verdict
            name="route",
            selector=route_on_verdict,                   # false-positive → close; else investigate
            choices=[close_step, investigate_step],
        ),
        Loop(                                             # investigate until confident or capped
            name="investigate",
            steps=[Step(agent=investigation), Step(agent=threat_intel)],
            end_condition=lambda out: out.confidence >= 0.8 or out.needs_human,
            max_iterations=4,                             # budget guardrail
        ),
        Condition(                                        # only respond if action warranted
            name="respond",
            evaluator=lambda ctx: ctx.recommended_action is not None,
            steps=[Step(agent=response)],                 # destructive tools pause for approval
        ),
        Step(name="report", agent=reporting),
    ],
)
```

- **Loop** repeats enrichment steps until `end_condition` (confidence threshold or
  human-needed) or `max_iterations` — the autonomous investigation loop.
- **Router / Condition** encode the decision logic (close vs investigate vs respond).
- **Session state** persists to `PostgresDb`, so a paused run (awaiting approval) resumes
  exactly where it stopped — durability + replay.

## 6. Governance — hooks, HITL approval, guardrails

Governance is the safety spine. Three layers:

### 6.1 Tool hooks (audit + access control) — every call
```python
def audit_hook(function_name, function_call, arguments):
    started = time.monotonic()
    audit.write(tenant_id(), actor="argus", action=function_name, args=redact(arguments))
    try:
        result = function_call(**arguments)          # proceed
        return result
    finally:
        metrics.observe(function_name, time.monotonic() - started)

def tenant_guard_hook(function_name, function_call, arguments):
    # hard tenant isolation: no tool may query outside the run's tenant
    arguments = enforce_tenant_scope(arguments, tenant_id())
    return function_call(**arguments)
```
Registered on every agent via `tool_hooks=[audit_hook, tenant_guard_hook]`.

### 6.2 Human-in-the-loop approval (destructive actions)
```python
from agno.tools import tool

@tool(requires_confirmation=True)      # isolate host = consequential → pause
def soar_isolate_host(host_id: str, reason: str) -> str:
    return edr.isolate(host_id, reason)

# run pauses instead of executing:
run = argus.run("Handle incident INC-4821", session_id=sid)
if run.is_paused:
    for req in run.active_requirements:
        if req.needs_confirmation:
            # surfaced to the analyst in the OpenUI chat as an Approval card
            approved = await ui_await_decision(req.tool_execution)   # Approve / Deny
            req.confirm() if approved else req.reject()
    run = argus.continue_run(run_id=run.run_id, requirements=run.requirements)
```
- The **autonomy policy engine** decides per (tenant, action class): `auto` (no gate),
  `approve` (HITL), or `deny`. Non-destructive actions (notify, enrich, ticket) default
  `auto`; isolate/disable/block default `approve`.
- **Kill switch** per tenant flips all classes to `deny` instantly.

### 6.3 Guardrails (input/output safety)
- `PromptInjectionGuardrail` on team `pre_hooks` — event/log content is untrusted input;
  block injection attempts embedded in alerts.
- `PIIDetectionGuardrail` — optional redaction before telemetry reaches the LLM.
- Custom `output_policy_hook` — validate recommended actions against policy before surfacing.

## 7. Tools via MCP

Tools are exposed as **MCP servers** so they're reusable, language-agnostic, and testable
independently. Agno connects with `MCPTools`/`MultiMCPTools`.

```python
from agno.tools.mcp import MultiMCPTools

tools = MultiMCPTools(
    server_params=[
        {"transport": "streamable-http", "url": "http://mcp-clickhouse:8931/mcp"},
        {"transport": "streamable-http", "url": "http://mcp-opensearch:8932/mcp"},
        {"transport": "streamable-http", "url": "http://mcp-threatintel:8933/mcp"},
        {"transport": "streamable-http", "url": "http://mcp-soar:8934/mcp"},
    ],
)
```

MCP servers to build (each tenant-scoped via bearer token / tenant header):
- **mcp-clickhouse** — parameterized read queries over the events datalake (tenant-filtered).
- **mcp-opensearch** — search + federated queries (incl. external Splunk/Elastic/Sentinel).
- **mcp-threatintel** — VT / AbuseIPDB / OTX / MISP lookups.
- **mcp-soar** — response actions (notify/block/isolate/disable/ticket), destructive ones
  marked `requires_confirmation`.
- **mcp-rules** — search/backtest/validate rules; Sigma import.

## 8. Memory, knowledge (RAG), durability

- **Session storage:** `PostgresDb` persists runs, so investigations survive restarts and
  paused approvals resume. Tenant id is part of every session key.
- **User/agent memory:** per-tenant memories (known-good IPs, prior verdicts, analyst
  preferences) to reduce repeat work and false positives.
- **Knowledge (agentic RAG):** tenant-scoped knowledge base over the org's runbooks, past
  cases, and detection docs (pgvector). `search_knowledge=True` lets agents pull context
  on demand. Strict tenant partition — no cross-tenant retrieval.

## 9. Serving & runtime — AgentOS

AgentOS is the self-hosted runtime. It returns a FastAPI app, exposes 80+ REST endpoints
(run agents/teams/workflows; manage sessions, memory, knowledge, traces, evals,
schedules, **approvals**), and ships a browser **control plane** that connects directly to
our runtime. **Data stays in our own DB — nothing goes to Agno.**

```python
from agno.os import AgentOS

agent_os = AgentOS(
    id="aegis",
    agents=[triage, investigation, threat_intel, response, detection_eng, reporting],
    teams=[argus],
    workflows=[incident_response],
    db=db,
)
app = agent_os.get_app()          # mount alongside the FastAPI BFF (see 02-architecture)
# uvicorn agentos:app --port 7777
```

- **Auth:** JWT + RBAC + shared security key + scoped service accounts → we map AgentOS
  identities to Aegis tenants/roles; the BFF injects `tenant_id` into every run's context.
- **Approvals endpoint** backs the HITL flow surfaced in the OpenUI chat.
- **Schedules** back autonomous "always-on" triage and scheduled hunts.

## 10. Multi-tenancy for agents

- Every run carries `tenant_id` (from the authenticated session) in session state +
  context; `tenant_guard_hook` rewrites tool args to force tenant scope.
- MCP tool calls include the tenant bearer token → ClickHouse row policy / OpenSearch DLS
  / Postgres RLS enforce isolation at the data layer too (defense in depth).
- Per-tenant **token/step budgets** and **kill switch**; usage metered for billing.
- Memory/knowledge namespaces are per-tenant; no shared retrieval.

## 11. Observability & evals

- Built-in Agno session metrics (tokens, latency, tool calls) → exported via OpenTelemetry
  to **Langfuse** for traces, cost, and **replay**.
- **Evals:** golden-set of historical incidents with known-correct verdicts; run agent
  evals in CI to catch regressions in triage accuracy and false-auto-close rate.

## 12. How the chat uses this

The global **AI Assistant / chat** runs the `argus` team and streams results to the
frontend, which renders them as **generative UI via OpenUI** (alert cards, MITRE tables,
timelines, rule diffs, approval buttons). See [09-chat-generative-ui.md](09-chat-generative-ui.md).
