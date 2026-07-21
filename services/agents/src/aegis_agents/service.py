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

from aegis_agents.agents import build_assistant, build_db
from aegis_agents.context import argus_run_scope, build_session_state
from aegis_agents.team import build_argus
from aegis_agents.workflow import build_incident_workflow

if TYPE_CHECKING:
    from agno.agent import Agent
    from agno.db.postgres import PostgresDb
    from agno.team import Team
    from agno.workflow import Workflow

log = get_logger(__name__)


# Agno event discriminators (``event.event``) that carry the LEADER's answer deltas.
# Everything else — reasoning deltas, tool calls, member hand-offs — is filtered out so
# the chain-of-thought never leaks into the reply. See ``iter_text``.
_ANSWER_EVENTS = {"TeamRunContent", "RunContent"}


class _TextEvent:
    """A synthetic answer event (``.content``) so injected text flows through ``iter_text``."""

    __slots__ = ("content", "event")

    def __init__(self, content: str, event: str = "TeamRunContent") -> None:
        self.content = content
        self.event = event


class ArgusService:
    """Facade over the Argus crew for incident handling, chat, and rule engineering."""

    def __init__(self, db: PostgresDb | None = None) -> None:
        self._db = db if db is not None else self._try_db()
        self._team: Team | None = None
        self._assistant: Agent | None = None
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
    def assistant(self) -> Agent:
        if self._assistant is None:
            self._assistant = build_assistant(self._db)
        return self._assistant

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

    def chat(self, tenant_id: str, message: str, *, session_id: str | None = None, stream: bool = True) -> Iterator[Any]:
        """Analyst chat with the crew (AI Assistant) — yields live run events (token stream).

        ``stream=True`` (default) streams the leader's answer deltas as they're generated so
        the UI renders progressively (and OpenUI Lang paints as generative UI live).
        ``iter_text`` filters the stream to the leader's answer only (no reasoning leak).
        When ``AEGIS_MCP_ENABLED=1`` the crew runs with the OpenSearch MCP toolset connected.
        """
        from aegis_agents.mcp import build_mcp_tools, mcp_enabled  # noqa: PLC0415

        if mcp_enabled():
            return self._chat_with_mcp_stream(tenant_id, message, session_id, build_mcp_tools)
        return self._chat_stream(tenant_id, message, session_id)

    def _chat_stream(self, tenant_id: str, message: str, session_id: str | None) -> Iterator[Any]:
        """Stream the fast single assistant agent (one LLM call → RunContent deltas).

        The agent runs on a dedicated worker thread so the whole run — tenant scope + tool
        calls + streaming — lives in ONE context. (Starlette iterates the SSE generator across
        threadpool threads, which would otherwise break the ``argus_run_scope`` contextvar.)
        """
        def _run(put: Any) -> None:
            with argus_run_scope(tenant_id):
                # Build inside the tenant scope so the model picks up the tenant's own
                # OpenRouter key/model (BYO-key) when they've connected one; else the default.
                assistant = build_assistant(self._db)
                for event in assistant.run(
                    message, stream=True, session_id=session_id, user_id=self._memory_user(tenant_id)
                ):
                    put(event)

        yield from self._pump(_run, tenant_id)

    def _pump(self, run: Any, tenant_id: str) -> Iterator[Any]:
        """Run ``run(put)`` on a worker thread and yield the events it enqueues (single context)."""
        import queue as _queue  # noqa: PLC0415
        import threading  # noqa: PLC0415

        q: _queue.Queue[Any] = _queue.Queue()
        sentinel = object()

        def _worker() -> None:
            try:
                run(q.put)
            except Exception as exc:  # noqa: BLE001 - surface to the client stream
                log.error("argus.chat.error", tenant_id=tenant_id, error=str(exc))
                q.put(_TextEvent(f"⚠️ Assistant error: {exc}"))
            finally:
                q.put(sentinel)

        threading.Thread(target=_worker, daemon=True).start()
        while True:
            item = q.get()
            if item is sentinel:
                break
            yield item

    def _chat_with_mcp_stream(self, tenant_id: str, message: str, session_id: str | None, build_mcp_tools: Any) -> Iterator[Any]:
        """Stream a chat turn with the OpenSearch MCP toolset connected. The MCP session is
        async-only, so the streaming run is driven on a worker thread (single context)."""
        import asyncio  # noqa: PLC0415

        def _run(put: Any) -> None:
            async def _arun() -> None:
                mcp = build_mcp_tools()
                async with mcp:  # connects the MCP session(s)
                    assistant = build_assistant(self._db, extra_tools=[mcp])
                    with argus_run_scope(tenant_id):
                        async for event in assistant.arun(
                            message, stream=True, session_id=session_id, user_id=self._memory_user(tenant_id)
                        ):
                            put(event)

            asyncio.run(_arun())

        yield from self._pump(_run, tenant_id)

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
    """Stream the leader's answer text from a run's event iterator (for SSE relays).

    Only answer-content events pass — reasoning deltas, tool calls, and member hand-offs
    are dropped so the reply never leaks the crew's chain-of-thought.
    """
    for event in run_events:
        if getattr(event, "event", None) not in _ANSWER_EVENTS:
            continue
        content = getattr(event, "content", None)
        if isinstance(content, str) and content:
            yield content


argus_service = ArgusService()
"""Process-wide service instance (lazy: nothing is built until first use)."""
