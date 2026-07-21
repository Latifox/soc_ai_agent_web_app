"""MCP tool wiring — connect the crew to the remote MCP servers.

Native in-process tools remain the default (zero infra). When the MCP sidecars are up
(``mcp-threatintel --http``, ``mcp-soar --http``, and the upstream
``opensearch-agent-server --with-mcp``), set ``AEGIS_MCP_ENABLED=1`` and attach
``build_mcp_tools()`` to agents — same tool names, served out-of-process.
"""

from __future__ import annotations

import os
from typing import Any

from aegis_core import get_logger, get_settings

log = get_logger(__name__)

DEFAULT_ENDPOINTS = {
    "threatintel": "http://localhost:8933/mcp",
    "soar": "http://localhost:8934/mcp",
}


def mcp_enabled() -> bool:
    """Remote MCP tools are opt-in (native tools are the local-first default)."""
    return os.environ.get("AEGIS_MCP_ENABLED", "").lower() in {"1", "true", "yes"}


def mcp_endpoints() -> list[str]:
    """The MCP endpoints for this deployment (ours + opensearch-agent-server)."""
    settings = get_settings()
    urls = [
        os.environ.get("MCP_THREATINTEL_URL", DEFAULT_ENDPOINTS["threatintel"]),
        os.environ.get("MCP_SOAR_URL", DEFAULT_ENDPOINTS["soar"]),
        f"{settings.opensearch_agent_server_url.rstrip('/')}/mcp",
    ]
    return urls


def build_mcp_tools() -> Any | None:
    """Return ``MultiMCPTools`` over all endpoints, or ``None`` when disabled."""
    if not mcp_enabled():
        return None
    from agno.tools.mcp import MultiMCPTools  # noqa: PLC0415

    urls = mcp_endpoints()
    log.info("mcp.connect", endpoints=urls)
    return MultiMCPTools(urls=urls, urls_transports=["streamable-http"] * len(urls))
