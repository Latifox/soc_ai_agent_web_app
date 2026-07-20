"""MCP server: SOAR response actions.

Non-destructive actions (notify, ticket) execute directly. Destructive actions
(block_ip, isolate_host, disable_user) return ``status: pending_approval`` — the MCP layer
cannot pause like Agno's ``requires_confirmation``, so the orchestrator/autonomy policy
records an approval and executes on decision. Every call is tenant-scoped and audited.
See docs/03-agents.md §6.2. Executors are stubs pending real connectors.
"""

from __future__ import annotations

import sys
from typing import Any

from mcp.server.fastmcp import FastMCP

from aegis_core import audit_chain, get_logger

log = get_logger(__name__)
mcp = FastMCP("aegis-soar")


def _audit(tenant_id: str, action: str, meta: dict[str, Any]) -> None:
    audit_chain.record(tenant_id=tenant_id, actor="argus", actor_type="agent", action=action, meta=meta)


@mcp.tool()
def soar_notify(tenant_id: str, channel: str, message: str) -> dict[str, Any]:
    """Send a notification (slack/teams/email/pagerduty). Non-destructive."""
    _audit(tenant_id, "soar.notify", {"channel": channel})
    return {"status": "sent", "channel": channel}


@mcp.tool()
def soar_create_ticket(tenant_id: str, system: str, title: str, body: str) -> dict[str, Any]:
    """Create a ticket (Jira/ServiceNow). Non-destructive."""
    _audit(tenant_id, "soar.ticket", {"system": system, "title": title})
    return {"status": "created", "system": system}


@mcp.tool()
def soar_block_ip(tenant_id: str, ip: str, reason: str) -> dict[str, Any]:
    """Block an IP (firewall/Cloudflare). DESTRUCTIVE — returns pending_approval."""
    _audit(tenant_id, "soar.block_ip", {"ip": ip, "reason": reason, "gated": True})
    return {"status": "pending_approval", "action": "block_ip", "ip": ip}


@mcp.tool()
def soar_isolate_host(tenant_id: str, host_id: str, reason: str) -> dict[str, Any]:
    """Isolate a host (EDR). DESTRUCTIVE — returns pending_approval."""
    _audit(tenant_id, "soar.isolate_host", {"host_id": host_id, "reason": reason, "gated": True})
    return {"status": "pending_approval", "action": "isolate_host", "host_id": host_id}


@mcp.tool()
def soar_disable_user(tenant_id: str, user_id: str, reason: str) -> dict[str, Any]:
    """Suspend/disable a user (Okta/AzureAD/AD). DESTRUCTIVE — returns pending_approval."""
    _audit(tenant_id, "soar.disable_user", {"user_id": user_id, "reason": reason, "gated": True})
    return {"status": "pending_approval", "action": "disable_user", "user_id": user_id}


def main() -> None:
    """Entry point. ``--http`` serves streamable-http; default is stdio."""
    mcp.run(transport="streamable-http") if "--http" in sys.argv else mcp.run()


if __name__ == "__main__":
    main()
