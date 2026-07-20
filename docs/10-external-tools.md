# 10 — External tools we exploit (OpenSearch Agent Server + ClickHouse Agent Skills)

Two upstream projects are adopted directly instead of being rebuilt.

---

## 1. OpenSearch Agent Server — the OpenSearch tool/MCP layer

Repo: https://github.com/opensearch-project/opensearch-agent-server

- **What it is:** a Python 3.12+ **FastAPI** server (default **:8001**) that gives AI agents
  real-time access to OpenSearch — search/query execution, index browsing/management, and
  aggregation/analysis tools.
- **Interfaces it exposes:** REST (`/health`, `/agents`, `/runs`), **SSE** streaming,
  **MCP** (data-access integration layer), and the **AG-UI** protocol.
- **Run:**
  ```bash
  pip install opensearch-agent-server
  opensearch-agent-server --with-mcp          # exposes the MCP integration
  ```

### How Aegis uses it
- It **replaces our hand-built `mcp-opensearch`** (TODO **AI-01**). We run
  `opensearch-agent-server --with-mcp` as a sidecar and let the Argus **Investigation** and
  **Threat-Intel** agents connect to its **MCP** endpoint (see [03-agents §7](03-agents.md)).
- Aegis wraps it with a thin **tenant guard**: every call injects the tenant's index prefix
  `t-{tenant}-*` / document-level-security filter so the agent can only see its tenant's
  data (defense-in-depth on top of OpenSearch DLS).
- Its REST/SSE surface can also back **federated search** and, optionally, the OpenSearch
  Dashboards AG-UI — but our operator chat stays on **OpenUI** ([09](09-chat-generative-ui.md)).

```python
# services/agents/tools/opensearch.py — connect Agno to the agent-server's MCP
from agno.tools.mcp import MCPTools
opensearch_mcp = MCPTools(
    transport="streamable-http",
    url="http://opensearch-agent-server:8001/mcp",   # --with-mcp
    # headers injected per-run: {"x-aegis-tenant": tenant_id}
)
```

---

## 2. ClickHouse Agent Skills — expertise for the build loop + local chdb

Repo: https://github.com/ClickHouse/agent-skills

- **What it is:** **Agent Skills** (the open agentskills.io format: `SKILL.md` +
  `AGENTS.md`) that extend AI coding agents (Claude Code, Cursor, …) with ClickHouse
  domain expertise. **Not** an MCP server — these teach the agent.
- **Skills included (8):** ClickHouse Best Practices (28 rules: schema/query/ingest),
  Architecture Advisor, JS/Node client troubleshooting, **chdb DataStore** (pandas-style
  in-process analytics), **chdb SQL** (in-process ClickHouse SQL, *no server*),
  **clickhousectl Local Dev**, clickhousectl Cloud Deploy, ClickStack OTel Collector.
- **Install:**
  ```bash
  npx skills add clickhouse/agent-skills     # into .claude/skills/
  # or
  clickhousectl skills
  ```

### How Aegis uses it
1. **Build-loop expertise (TODO INFRA-08):** install the skills into the repo's
   `.claude/skills/`. When the loop's **BUILDER**/**AI-ARCH** agents write ClickHouse
   schema (**BE-06**), rule compilers (**BE-11**), or ingestion sinks (**BE-08/09**), the
   Best-Practices + Architecture-Advisor skills auto-activate → correct, optimized SQL.
2. **Local-first runtime with chdb:** for local dev we use **chdb** (in-process ClickHouse,
   no server) so contributors run the full detection path with zero infra. The
   `aegis-core` ClickHouse adapter selects backend by env:
   - `CLICKHOUSE_BACKEND=chdb` → in-process (local dev, default),
   - `CLICKHOUSE_BACKEND=server` → ClickHouse server (staging/prod, `clickhouse-connect`).
3. **clickhousectl Local Dev** skill drives the optional local ClickHouse server workflow;
   **ClickStack OTel** informs our telemetry pipeline.

> These skills live in the repo, so they benefit every coding agent — they are part of the
> loop's toolchain, not a runtime dependency.

---

## 3. Local-first (no S3 for now)

Per current scope, **object storage is local**:
- **Dev default:** raw-log archive, case artifacts, and generated reports write to a local
  `./data/` directory via the `aegis-core.storage` abstraction (`STORAGE_BACKEND=local`).
- **ClickHouse:** local **chdb** (in-process) — no server, no S3.
- **Prod (later):** flip `STORAGE_BACKEND` to `supabase` (Supabase Storage) or `s3`, and
  `CLICKHOUSE_BACKEND` to `server`. The abstraction keeps call sites unchanged.

No MinIO/S3 container is required to run Aegis locally.
