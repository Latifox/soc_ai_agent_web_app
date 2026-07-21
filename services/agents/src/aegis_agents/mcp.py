"""MCP tool wiring — connect the Argus crew to the official OpenSearch MCP server.

Native in-process tools (``opensearch_search`` etc.) remain the zero-infra default. When the
OpenSearch MCP server is running (``opensearch-mcp-server-py``:
``python -m mcp_server_opensearch --transport stream --port 9900``) set ``AEGIS_MCP_ENABLED=1``
to give the crew its richer cluster toolset over MCP — ListIndex, IndexMapping, SearchIndex,
Count, Explain, Msearch, GetShards, ClusterHealth, and GenericOpenSearchApi.

The MCP server is configured (via its own env: ``OPENSEARCH_URL``/``OPENSEARCH_USERNAME``/
``OPENSEARCH_PASSWORD``) to point at the tenant's cluster; tools also accept ``opensearch_url``
per call. Optional threat-intel / SOAR MCP sidecars can be added via env.
"""

from __future__ import annotations

import os
from typing import Any

from aegis_core import get_logger, get_settings

log = get_logger(__name__)

# Tools the OpenSearch MCP server exposes (for prompt/awareness + optional filtering).
OPENSEARCH_MCP_TOOLS = [
    "ListIndexTool", "IndexMappingTool", "SearchIndexTool", "GetShardsTool",
    "ClusterHealthTool", "CountTool", "ExplainTool", "MsearchTool", "GenericOpenSearchApiTool",
]


def mcp_enabled() -> bool:
    """Remote MCP tools are opt-in (native tools are the local-first default)."""
    return os.environ.get("AEGIS_MCP_ENABLED", "").lower() in {"1", "true", "yes"}


def mcp_endpoints() -> list[str]:
    """The MCP endpoints for this deployment (OpenSearch MCP + optional sidecars)."""
    settings = get_settings()
    urls = [os.environ.get("OPENSEARCH_MCP_URL", settings.opensearch_mcp_url)]
    if ti := os.environ.get("MCP_THREATINTEL_URL"):
        urls.append(ti)
    if soar := os.environ.get("MCP_SOAR_URL"):
        urls.append(soar)
    return urls


def build_mcp_tools() -> Any | None:
    """Return an unconnected ``MultiMCPTools`` over the endpoints, or ``None`` when disabled.

    Agno connects it as an async context manager at run time — see ``ArgusService.chat``
    which enters ``async with build_mcp_tools()`` and attaches it to the team for that run.
    """
    if not mcp_enabled():
        return None
    from agno.tools.mcp import MultiMCPTools  # noqa: PLC0415

    urls = mcp_endpoints()
    log.info("mcp.connect", endpoints=urls)
    return MultiMCPTools(urls=urls, urls_transports=["streamable-http"] * len(urls))
