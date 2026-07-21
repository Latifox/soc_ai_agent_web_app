"""Argus supervisor — an Agno ``Team`` whose leader delegates to the crew.

The leader plans, delegates to members (concurrently where independent), and synthesizes.
Input guardrails run as team ``pre_hooks`` because event/log content is untrusted
(prompt-injection defense). See ``docs/03-agents.md`` §4, §6.3.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from agno.team import Team

from aegis_agents import instructions as ins
from aegis_agents.agents import build_crew
from aegis_agents.hooks import HOOKS
from aegis_agents.models import reasoner
from aegis_agents.tools import (
    ioc_reputation,
    opensearch_cluster_health,
    opensearch_count,
    opensearch_index_mapping,
    opensearch_list_indices,
    opensearch_search,
)

if TYPE_CHECKING:
    from agno.db.postgres import PostgresDb

# Tools the leader can call DIRECTLY (no member fan-out) so simple analyst questions —
# "top source IPs", "count failed logins", "which indices exist" — answer in one turn
# instead of delegating to the crew. Deep multi-step investigations still delegate.
_LEADER_TOOLS = [
    opensearch_search,
    opensearch_list_indices,
    opensearch_index_mapping,
    opensearch_count,
    opensearch_cluster_health,
    ioc_reputation,
]


def _guardrails() -> list[Any]:
    """Return available Agno input guardrails (version-tolerant)."""
    hooks: list[Any] = []
    try:
        from agno.guardrails import PromptInjectionGuardrail  # noqa: PLC0415

        hooks.append(PromptInjectionGuardrail())
    except ImportError:
        pass
    return hooks


def build_argus(db: PostgresDb | None = None, *, extra_tools: list[Any] | None = None) -> Team:
    """Build the Argus supervisor team over the full crew.

    ``extra_tools`` (e.g. a connected ``MultiMCPTools`` for the OpenSearch MCP server) are
    attached at the team level so the leader can call them directly.
    """
    crew = build_crew(db)
    tools = [*_LEADER_TOOLS, *(extra_tools or [])]
    return Team(
        name="Argus SOC",
        model=reasoner(),
        members=list(crew.values()),
        tools=tools,
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.SUPERVISOR,
        pre_hooks=_guardrails(),
        add_history_to_context=True,
        markdown=True,
    )
