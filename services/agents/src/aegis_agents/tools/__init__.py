"""Argus tools — native (function) tools + MCP tool layer.

Native tools call tenant-scoped Aegis services (ClickHouse, SOAR, rules) and enforce
isolation via the tenant context. The OpenSearch tool layer is the upstream
``opensearch-agent-server`` reached over MCP (see ``docs/10-external-tools.md``);
``build_opensearch_mcp`` constructs that connection.
"""

from __future__ import annotations

from aegis_agents.tools.clickhouse import clickhouse_query
from aegis_agents.tools.opensearch import opensearch_search
from aegis_agents.tools.rules import rule_backtest, rule_validate
from aegis_agents.tools.soar import (
    soar_block_ip,
    soar_create_ticket,
    soar_disable_user,
    soar_isolate_host,
    soar_notify,
)
from aegis_agents.tools.threat_intel import ioc_reputation


def build_opensearch_mcp():  # noqa: ANN201 - agno MCPTools type imported lazily
    """Connect to the upstream ``opensearch-agent-server`` MCP endpoint (docs/10)."""
    from agno.tools.mcp import MCPTools  # noqa: PLC0415

    from aegis_core import get_settings  # noqa: PLC0415

    base = get_settings().opensearch_agent_server_url.rstrip("/")
    return MCPTools(transport="streamable-http", url=f"{base}/mcp")


__all__ = [
    "build_opensearch_mcp",
    "clickhouse_query",
    "ioc_reputation",
    "opensearch_search",
    "rule_backtest",
    "rule_validate",
    "soar_block_ip",
    "soar_create_ticket",
    "soar_disable_user",
    "soar_isolate_host",
    "soar_notify",
]
