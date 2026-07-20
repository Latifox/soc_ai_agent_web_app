"""SOAR response tools.

Non-destructive actions (notify, ticket) run freely. Destructive actions
(block IP, isolate host, disable user) are marked ``requires_confirmation=True`` so the
Agno run **pauses** for human approval before executing — the HITL approval gate
(see ``docs/03-agents.md`` §6.2). The autonomy policy engine may pre-approve a class
per tenant, but the default is human approval.

Executors are stubs that log the action; real connectors (Cloudflare/EDR/Okta/Jira)
land with the SOAR epic.
"""

from __future__ import annotations

from typing import Any

from agno.tools import tool

from aegis_core import current_tenant_id, get_logger

log = get_logger(__name__)


@tool(name="soar_notify")
def soar_notify(channel: str, message: str) -> dict[str, Any]:
    """Send a notification. Non-destructive.

    Args:
        channel: ``slack``, ``teams``, ``email``, or ``pagerduty``.
        message: The message body.
    """
    log.info("soar.notify", tenant_id=current_tenant_id(), channel=channel)
    return {"status": "sent", "channel": channel}


@tool(name="soar_create_ticket")
def soar_create_ticket(system: str, title: str, body: str) -> dict[str, Any]:
    """Create a ticket in Jira/ServiceNow. Non-destructive."""
    log.info("soar.ticket", tenant_id=current_tenant_id(), system=system)
    return {"status": "created", "system": system, "title": title}


@tool(name="soar_block_ip", requires_confirmation=True)
def soar_block_ip(ip: str, reason: str) -> dict[str, Any]:
    """Block an IP at the firewall/Cloudflare. DESTRUCTIVE — requires human approval."""
    log.info("soar.block_ip", tenant_id=current_tenant_id(), ip=ip, reason=reason)
    return {"status": "blocked", "ip": ip}


@tool(name="soar_isolate_host", requires_confirmation=True)
def soar_isolate_host(host_id: str, reason: str) -> dict[str, Any]:
    """Isolate a host via EDR. DESTRUCTIVE — requires human approval."""
    log.info("soar.isolate_host", tenant_id=current_tenant_id(), host_id=host_id, reason=reason)
    return {"status": "isolated", "host_id": host_id}


@tool(name="soar_disable_user", requires_confirmation=True)
def soar_disable_user(user_id: str, reason: str) -> dict[str, Any]:
    """Suspend/disable a user (Okta/Azure AD/AD). DESTRUCTIVE — requires human approval."""
    log.info("soar.disable_user", tenant_id=current_tenant_id(), user_id=user_id, reason=reason)
    return {"status": "disabled", "user_id": user_id}
