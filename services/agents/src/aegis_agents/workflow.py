"""Incident-response workflow — the bounded autonomous loop (Agno Workflows 2.0).

Pipeline: triage -> (Router: close | investigate) -> Loop[investigate+enrich until
confident or capped] -> Condition[respond if action warranted] -> report. Session state
persists to Postgres, so a run paused on an approval resumes exactly where it stopped.

The Router/Loop/Condition callables read the previous step's content heuristically; tune
the parsing to the crew's structured output as it stabilizes. See ``docs/03-agents.md`` §5.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from agno.workflow import Condition, Loop, Router, Step, Workflow

from aegis_agents.agents import (
    build_detection_eng,  # noqa: F401 - available to extend the pipeline
    build_investigation,
    build_reporting,
    build_response,
    build_threat_intel,
    build_triage,
)

if TYPE_CHECKING:
    from agno.db.postgres import PostgresDb

_MAX_INVESTIGATION_LOOPS = 4


def _content(step_input: Any) -> str:
    """Best-effort text of the previous step's output."""
    return str(getattr(step_input, "previous_step_content", "") or "").lower()


def _looks_false_positive(step_input: Any) -> bool:
    text = _content(step_input)
    return "false_positive: true" in text or "false positive" in text or "auto-close" in text


def build_incident_workflow(db: PostgresDb | None = None) -> Workflow:
    """Build the incident-response workflow."""
    triage = Step(name="triage", agent=build_triage(db))
    close = Step(name="close", agent=build_reporting(db))  # write the FP close-out
    investigate = Step(name="investigate", agent=build_investigation(db))
    enrich = Step(name="enrich", agent=build_threat_intel(db))
    respond = Step(name="respond", agent=build_response(db))
    report = Step(name="report", agent=build_reporting(db))

    def route_after_triage(step_input: Any) -> list[Step]:
        """Close clear false positives; otherwise investigate."""
        return [close] if _looks_false_positive(step_input) else [investigate_loop, respond_cond, report]

    def investigated_enough(outputs: Any) -> bool:
        """Stop the loop once confident or human input is needed."""
        text = str(outputs).lower()
        return "confidence: 0.8" in text or "confidence: 0.9" in text or "needs_human" in text

    def action_warranted(step_input: Any) -> bool:
        text = _content(step_input)
        return "recommended action" in text or "recommend" in text

    investigate_loop = Loop(
        name="investigate",
        steps=[investigate, enrich],
        end_condition=investigated_enough,
        max_iterations=_MAX_INVESTIGATION_LOOPS,
    )
    respond_cond = Condition(name="maybe_respond", evaluator=action_warranted, steps=[respond])

    return Workflow(
        name="Incident Response",
        db=db,
        steps=[
            triage,
            Router(name="route", selector=route_after_triage, choices=[close, investigate_loop]),
        ],
    )
