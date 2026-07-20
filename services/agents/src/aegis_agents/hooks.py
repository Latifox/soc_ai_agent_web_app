"""Governance tool hooks — audit + tenant guard (see ``docs/03-agents.md`` §6.1).

Every agent registers these via ``tool_hooks=[...]`` so **each** tool call is (a) bound
to a tenant context (hard isolation — no tool may run without one) and (b) recorded with
timing for the audit trail. Hooks wrap execution: call ``function_call(**arguments)`` to
proceed, or raise to block.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

from aegis_core import get_logger, get_tenant_context
from aegis_core.errors import TenantContextError

log = get_logger(__name__)

_SENSITIVE = frozenset({"password", "secret", "token", "api_key", "apikey", "authorization"})


def _redact(arguments: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of ``arguments`` with sensitive values masked for logging."""
    return {k: ("***" if k.lower() in _SENSITIVE else v) for k, v in arguments.items()}


def tenant_guard_hook(
    function_name: str,
    function_call: Callable[..., Any],
    arguments: dict[str, Any],
) -> Any:
    """Refuse any tool call made outside an active tenant context."""
    if get_tenant_context() is None:
        raise TenantContextError(f"tool {function_name!r} called without a tenant context")
    return function_call(**arguments)


def audit_hook(
    function_name: str,
    function_call: Callable[..., Any],
    arguments: dict[str, Any],
) -> Any:
    """Record every tool call (tenant, args, latency, outcome) to the audit log."""
    ctx = get_tenant_context()
    tenant_id = ctx.tenant_id if ctx else None
    started = time.monotonic()
    log.info("agent.tool.start", tool=function_name, tenant_id=tenant_id, args=_redact(arguments))
    try:
        result = function_call(**arguments)
    except Exception as exc:  # noqa: BLE001 - re-raised after auditing
        log.error("agent.tool.error", tool=function_name, tenant_id=tenant_id, error=str(exc))
        raise
    log.info(
        "agent.tool.ok",
        tool=function_name,
        tenant_id=tenant_id,
        ms=round((time.monotonic() - started) * 1000, 1),
    )
    return result


HOOKS = [tenant_guard_hook, audit_hook]
"""Default hook chain applied to every Argus agent."""
