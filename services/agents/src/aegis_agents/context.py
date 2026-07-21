"""Run context for Argus — what every agent knows about the work at hand.

``build_session_state`` assembles the per-run session state (tenant, incident, autonomy
policy, budgets) that flows to every member agent via the Team's shared context.
``argus_run_scope`` binds the :class:`~aegis_core.TenantContext` for the duration of a
run so tool hooks and adapters enforce isolation.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from aegis_core import TenantContext, reset_tenant_context, set_tenant_context

DEFAULT_BUDGET = {"max_tool_calls": 40, "max_investigation_loops": 4}


def build_session_state(
    *,
    tenant_id: str,
    incident: dict[str, Any] | None = None,
    autonomy: dict[str, str] | None = None,
    budget: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Session state shared across the crew for one run."""
    return {
        "tenant_id": tenant_id,
        "incident": incident or {},
        "autonomy_policy": autonomy or {},
        "budget": budget or dict(DEFAULT_BUDGET),
        "findings": [],  # members append evidence as they work
    }


@contextmanager
def argus_run_scope(
    tenant_id: str,
    *,
    user_id: str | None = None,
    role: str = "agent",
    permissions: tuple[str, ...] = (),
) -> Iterator[TenantContext]:
    """Bind the tenant context for one agent run (tool hooks depend on it)."""
    ctx = TenantContext(tenant_id=tenant_id, user_id=user_id, role=role, permissions=permissions)
    token = set_tenant_context(ctx)
    try:
        yield ctx
    finally:
        reset_tenant_context(token)
