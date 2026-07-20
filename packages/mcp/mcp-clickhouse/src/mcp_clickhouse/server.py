"""MCP server: tenant-scoped, read-only ClickHouse queries.

Exposes ``clickhouse_query(sql, tenant_id)`` over MCP. The read-only guard + the core
adapter's tenant binding keep every call inside one tenant's data. Run with ``mcp-clickhouse``
(stdio) or ``mcp-clickhouse --http`` for streamable-http (default port from MCP).
"""

from __future__ import annotations

import re
import sys
from typing import Any

from mcp.server.fastmcp import FastMCP

from aegis_core import TenantContext, get_clickhouse, get_settings, set_tenant_context
from aegis_core.errors import PermissionDeniedError, TenantIsolationError

_READONLY = re.compile(r"^\s*(with|select)\b", re.IGNORECASE)
_FORBIDDEN = re.compile(r"\b(insert|alter|drop|delete|update|create|truncate|attach)\b", re.IGNORECASE)

mcp = FastMCP("aegis-clickhouse")


@mcp.tool()
def clickhouse_query(sql: str, tenant_id: str) -> list[dict[str, Any]]:
    """Run a READ-ONLY SELECT over a tenant's ClickHouse events datalake.

    Args:
        sql: A single read-only SELECT/WITH statement over ``events``/``detections``.
        tenant_id: The tenant whose data to query (rows are constrained to it).
    """
    if not tenant_id or not tenant_id.strip():
        raise TenantIsolationError("tenant_id is required")
    if not _READONLY.match(sql) or _FORBIDDEN.search(sql):
        raise PermissionDeniedError("only a single read-only SELECT/WITH statement is allowed")
    set_tenant_context(TenantContext(tenant_id=tenant_id))
    return get_clickhouse(get_settings()).query(sql, tenant_id=tenant_id)


def main() -> None:
    """Entry point. ``--http`` serves streamable-http; default is stdio."""
    if "--http" in sys.argv:
        mcp.run(transport="streamable-http")
    else:
        mcp.run()


if __name__ == "__main__":
    main()
