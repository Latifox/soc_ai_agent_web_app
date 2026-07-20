"""Claude model tiers for the Argus crew (via Agno).

Three tiers balance reasoning depth against cost/latency (see ``docs/03-agents.md`` §2):
``reasoner`` for hard investigation/planning, ``balanced`` for drafting, ``fast`` for
cheap classification. Model ids come from :class:`aegis_core.Settings` so they are
configured in one place.
"""

from __future__ import annotations

from agno.models.anthropic import Claude

from aegis_core import get_settings


def reasoner() -> Claude:
    """Heavy-reasoning tier (investigation, detection-engineering, supervisor)."""
    return Claude(id=get_settings().model_reasoner)


def balanced() -> Claude:
    """Balanced tier (response drafting, reporting)."""
    return Claude(id=get_settings().model_balanced)


def fast() -> Claude:
    """Cheap/fast tier (triage classification, enrichment glue, guardrail checks)."""
    return Claude(id=get_settings().model_fast)
