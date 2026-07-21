"""ArgusService — the programmatic surface other Aegis services call.

One object owning the crew, workflow, and durable store. Every entry point binds the
tenant context (isolation), passes a tenant-scoped ``user_id`` (memory partitioning),
and shares session state (context) with the crew. The BFF, the incident consumer, and
AgentOS handlers all go through here.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import TYPE_CHECKING, Any

from aegis_core import audit_chain, get_logger

from aegis_agents.agents import build_db
from aegis_agents.context import argus_run_scope, build_session_state
from aegis_agents.team import build_argus
from aegis_agents.workflow import build_incident_workflow

if TYPE_CHECKING:
    from agno.db.postgres import PostgresDb
    from agno.team import Team
    from agno.workflow import Workflow

log = get_logger(__name__)


class _TextEvent:
    """A one-shot run event (``.content``) so buffered replies flow through ``iter_text``."""

    __slots__ = ("content",)

    def __init__(self, content: str) -> None:
        self.content = content


class ArgusService:
    """Facade over the Argus crew for incident handling, chat, and rule engineering."""

    def __init__(self, db: PostgresDb | None = None) -> None:
        self._db = db if db is not None else self._try_db()
        self._team: Team | None = None
        self._workflow: Workflow | None = None

    @staticmethod
    def _try_db() -> PostgresDb | None:
        try:
            return build_db()
        except Exception as exc:  # noqa: BLE001 - run stateless when Postgres is absent
            log.warning("argus.db.unavailable", error=str(exc))
            return None

    @property
    def team(self) -> Team:
        if self._team is None:
            self._team = build_argus(self._db)
        return self._team

    @property
    def workflow(self) -> Workflow:
        if self._workflow is None:
            self._workflow = build_incident_workflow(self._db)
        return self._workflow

    @staticmethod
    def _memory_user(tenant_id: str) -> str:
        """Memory partition key — memories never cross tenants."""
        return f"tenant:{tenant_id}"

    # ── Entry points ─────────────────────────────────────────────────────────

    def handle_incident(
        self,
        tenant_id: str,
        incident: dict[str, Any],
        *,
        autonomy: dict[str, str] | None = None,
    ) -> Any:
        """Run the autonomous incident-response workflow for one incident."""
        state = build_session_state(tenant_id=tenant_id, incident=incident, autonomy=autonomy)
        audit_chain.record(
            tenant_id=tenant_id, actor="argus", actor_type="agent",
            action="workflow.incident.start", target=str(incident.get("id")),
        )
        with argus_run_scope(tenant_id):
            return self.workflow.run(
                input=json.dumps(incident, default=str),
                session_state=state,
                user_id=self._memory_user(tenant_id),
            )

    def chat(self, tenant_id: str, message: str, *, session_id: str | None = None, stream: bool = True) -> Any:
        """Analyst chat with the crew (AI Assistant); returns the run or event iterator.

        When ``AEGIS_MCP_ENABLED=1`` the crew runs with the OpenSearch MCP toolset connected
        (ListIndex/Search/Count/Explain/…); that path buffers the reply (no token streaming).
        """
        from aegis_agents.mcp import build_mcp_tools, mcp_enabled  # noqa: PLC0415

        if mcp_enabled():
            return iter([_TextEvent(self._chat_with_mcp(tenant_id, message, session_id, build_mcp_tools))])

        # Buffer the FINAL answer only — streaming the team's raw events leaks the leader's
        # chain-of-thought and member hand-offs into the reply. iter_text sees one clean event.
        state = build_session_state(tenant_id=tenant_id)
        with argus_run_scope(tenant_id):
            resp = self.team.run(
                message,
                stream=False,
                session_id=session_id,
                session_state=state,
                user_id=self._memory_user(tenant_id),
            )
        return iter([_TextEvent(str(getattr(resp, "content", resp) or ""))])

    def _chat_with_mcp(self, tenant_id: str, message: str, session_id: str | None, build_mcp_tools: Any) -> str:
        """Run one chat turn with the OpenSearch MCP toolset connected. Returns the text."""
        import asyncio  # noqa: PLC0415

        async def _run() -> str:
            mcp = build_mcp_tools()
            async with mcp:  # connects the MCP session(s)
                team = build_argus(self._db, extra_tools=[mcp])
                with argus_run_scope(tenant_id):
                    resp = await team.arun(
                        message,
                        session_id=session_id,
                        session_state=build_session_state(tenant_id=tenant_id),
                        user_id=self._memory_user(tenant_id),
                    )
                return str(getattr(resp, "content", resp) or "")

        return asyncio.run(_run())

    def vibe_rule(self, tenant_id: str, prompt: str) -> Any:
        """NL -> detection rule via the Detection-Engineering agent (validated YAML)."""
        from aegis_agents.agents import build_detection_eng  # noqa: PLC0415

        with argus_run_scope(tenant_id):
            agent = build_detection_eng(self._db)
            return agent.run(
                f"Create a detection rule for: {prompt}. Validate it with rule_validate before answering.",
                user_id=self._memory_user(tenant_id),
            )

    def continue_paused(self, tenant_id: str, run_id: str, *, approved: bool) -> Any:
        """Resume a run paused on a destructive-tool confirmation (HITL)."""
        with argus_run_scope(tenant_id):
            run = self.team.get_run(run_id) if hasattr(self.team, "get_run") else None
            if run is None or not getattr(run, "active_requirements", None):
                return {"resumed": False, "reason": "run not found or not paused"}
            for requirement in run.active_requirements:
                if requirement.needs_confirmation:
                    requirement.confirm() if approved else requirement.reject()
            return self.team.continue_run(run_id=run_id, requirements=run.requirements)


def iter_text(run_events: Iterator[Any]) -> Iterator[str]:
    """Extract streamed text content from a run's event iterator (for SSE relays)."""
    for event in run_events:
        content = getattr(event, "content", None)
        if isinstance(content, str) and content:
            yield content


argus_service = ArgusService()
"""Process-wide service instance (lazy: nothing is built until first use)."""
