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
from aegis_agents.models import balanced, fast, reasoner
from aegis_agents.tools import (
    clickhouse_query,
    ioc_reputation,
    opensearch_search,
    rule_backtest,
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


def build_triage(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="Triage",
        role="Deduplicate, correlate and score incidents; decide auto-close vs escalate.",
        model=fast(),
        tools=[clickhouse_query],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.TRIAGE,
        markdown=True,
    )


def build_investigation(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="Investigation",
        role="Enrich alerts, query telemetry, build a MITRE-mapped attack narrative.",
        model=reasoner(),
        tools=[clickhouse_query, opensearch_search, ioc_reputation],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.INVESTIGATION,
        add_history_to_context=True,
        markdown=True,
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
    )


def build_detection_eng(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="DetectionEngineering",
        role="Generate and tune detection rules (Vibe Detection).",
        model=reasoner(),
        tools=[rule_validate, rule_backtest, clickhouse_query],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.DETECTION_ENG,
        markdown=True,
    )


def build_reporting(db: PostgresDb | None = None) -> Agent:
    return Agent(
        name="Reporting",
        role="Write case reports and executive summaries.",
        model=balanced(),
        tools=[clickhouse_query],
        tool_hooks=HOOKS,
        db=db,
        instructions=ins.REPORTING,
        markdown=True,
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
