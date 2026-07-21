"""The Argus crew — one Agno ``Agent`` per SOC role.

Every agent shares the governance hook chain (:data:`aegis_agents.hooks.HOOKS`) so all
tool calls are tenant-guarded and audited, and a shared :class:`~agno.db.postgres.PostgresDb`
so runs/memory persist (paused approvals resume). Model tier is chosen per role
(``docs/03-agents.md`` §2–3).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from agno.agent import Agent

from aegis_agents import instructions as ins
from aegis_agents.hooks import HOOKS
from aegis_agents.models import assistant as assistant_model
from aegis_agents.models import balanced, fast, reasoner
from aegis_agents.tools import (
    ioc_reputation,
    opensearch_cluster_health,
    opensearch_count,
    opensearch_index_mapping,
    opensearch_list_indices,
    opensearch_search,
    rule_backtest,
    rule_deploy,
    rule_validate,
    soar_block_ip,
    soar_create_ticket,
    soar_disable_user,
    soar_isolate_host,
    soar_notify,
)

if TYPE_CHECKING:
    from agno.db.postgres import PostgresDb


def build_db() -> PostgresDb:
    """Construct the shared Postgres session/memory store from settings."""
    from agno.db.postgres import PostgresDb  # noqa: PLC0415

    from aegis_core import get_settings  # noqa: PLC0415

    return PostgresDb(db_url=get_settings().pg_url)


def _memory_kwargs(db: PostgresDb | None) -> dict[str, bool]:
    """Persistent memory options — only when a durable store is attached.

    With memories enabled the crew retains per-tenant facts across runs (known-good
    IPs, prior verdicts, analyst preferences); the service layer passes a
    tenant-scoped ``user_id`` so memories never cross tenants.
    """
    if db is None:
        return {}
    return {"enable_user_memories": True, "enable_session_summaries": True}


def build_triage(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="Triage",
        role="Deduplicate, correlate and score incidents; decide auto-close vs escalate.",
        model=fast(),
        tools=[opensearch_search, opensearch_count, opensearch_list_indices],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.TRIAGE,
        markdown=True,
        **_memory_kwargs(db),
    )


def build_investigation(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="Investigation",
        role="Enrich alerts, query telemetry, build a MITRE-mapped attack narrative.",
        model=reasoner(),
        tools=[opensearch_search, opensearch_list_indices, opensearch_index_mapping, opensearch_count, opensearch_cluster_health, ioc_reputation],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.INVESTIGATION,
        add_history_to_context=True,
        markdown=True,
        **_memory_kwargs(db),
    )


def build_threat_intel(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="ThreatIntel",
        role="Look up IOC reputation and context.",
        model=fast(),
        tools=[ioc_reputation],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.THREAT_INTEL,
    )


def build_response(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="Response",
        role="Execute SOAR playbooks; destructive actions require human approval.",
        model=balanced(),
        tools=[
            soar_notify,
            soar_create_ticket,
            soar_block_ip,
            soar_isolate_host,
            soar_disable_user,
        ],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.RESPONSE,
        **_memory_kwargs(db),
    )


def build_detection_eng(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="DetectionEngineering",
        role="Generate and tune detection rules (Vibe Detection).",
        model=reasoner(),
        tools=[rule_validate, rule_backtest, opensearch_search],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.DETECTION_ENG,
        markdown=True,
        **_memory_kwargs(db),
    )


def build_reporting(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="Reporting",
        role="Write case reports and executive summaries.",
        model=balanced(),
        tools=[opensearch_search],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.REPORTING,
        markdown=True,
    )


def build_assistant(db: PostgresDb | None = None, *, extra_tools: list | None = None) -> Agent:
    """A single, fast, streaming SOC assistant for the interactive chat (AI Assistant).

    One agent = one LLM call: it streams tokens immediately and always answers (no 6-member
    fan-out, no slow reasoning phase). It has the tenant-scoped OpenSearch toolset directly so
    it can query the cluster and render findings as OpenUI Lang (generative UI). Use the crew
    Team for deep, multi-step incident workflows; use this for chat.
    """
    tools = [
        opensearch_search,
        opensearch_count,
        opensearch_list_indices,
        opensearch_index_mapping,
        opensearch_cluster_health,
        ioc_reputation,
        rule_validate,
        rule_backtest,
        rule_deploy,
        *(extra_tools or []),
    ]
    return Agent(
        name="Argus Assistant",
        model=assistant_model(),  # good, fast model — immediate output, reliable OpenUI Lang
        tools=tools,
        tool_hooks=HOOKS,
        # Cap tool calls so the model can't spiral into a per-entity count loop — but leave
        # enough headroom for the rule flow (search + validate + backtest + deploy).
        tool_call_limit=8,
        db=db,
        instructions=ins.ASSISTANT,
        markdown=True,
        **_memory_kwargs(db),
    )


def build_crew(db: PostgresDb | None = None) -> dict[str, Agent]:
    """Build every Argus member, sharing one ``db``."""
    return {
        "triage": build_triage(db),
        "investigation": build_investigation(db),
        "threat_intel": build_threat_intel(db),
        "response": build_response(db),
        "detection_eng": build_detection_eng(db),
        "reporting": build_reporting(db),
    }
