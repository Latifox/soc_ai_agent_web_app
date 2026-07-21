"""LLM model tiers for the Argus crew (via Agno).

Provider is configured by ``LLM_PROVIDER`` (default **openrouter** — one key, any model,
ids like ``anthropic/claude-sonnet-4.5``; set ``OPENROUTER_API_KEY``). ``anthropic``
switches to the direct API with native Claude ids. Three tiers balance reasoning depth
against cost/latency (see ``docs/03-agents.md`` §2); ids come from settings so they are
configured in one place.
"""

from __future__ import annotations

from typing import Any

from aegis_core import get_settings


def _model(model_id: str, *, extra_body: dict[str, Any] | None = None) -> Any:
    settings = get_settings()
    if settings.llm_provider == "openrouter":
        from agno.models.openrouter import OpenRouter  # noqa: PLC0415

        kwargs: dict[str, Any] = {}
        if extra_body:
            kwargs["extra_body"] = extra_body
        return OpenRouter(id=model_id, api_key=settings.openrouter_api_key or None, **kwargs)
    from agno.models.anthropic import Claude  # noqa: PLC0415

    return Claude(id=model_id)


def reasoner() -> Any:
    """Heavy-reasoning tier (investigation, detection-engineering, supervisor)."""
    return _model(get_settings().model_reasoner)


def balanced() -> Any:
    """Balanced tier (response drafting, reporting)."""
    return _model(get_settings().model_balanced)


def fast() -> Any:
    """Cheap/fast tier (triage classification, enrichment glue, guardrail checks)."""
    return _model(get_settings().model_fast)


def assistant() -> Any:
    """Interactive AI-Assistant tier — good quality, fast, reliable OpenUI Lang + tool use.

    Reasoning is disabled at the provider so hybrid/reasoning models (e.g. xiaomi/mimo) emit
    the final answer as normal content instead of trapping it in ``reasoning_content`` (which
    the stream filter drops) — and so the reply is fast, not stuck "thinking". Non-reasoning
    models ignore the flag.
    """
    return _model(get_settings().model_assistant, extra_body={"reasoning": {"enabled": False}})
