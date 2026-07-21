"""ClickHouse query tool — read-only, auto tenant-scoped.

The agent writes a SELECT over the tenant's events datalake; the tool forces tenant
scope through :func:`aegis_core.get_clickhouse` (which wraps the query and binds
``aegis_tenant``). Rows outside the caller's tenant are never returned.
"""

from __future__ import annotations

import re
from typing import Any

from agno.tools import tool

from aegis_core import clickhouse_for_tenant, current_tenant_id, get_settings
from aegis_core.errors import PermissionDeniedError

_READONLY = re.compile(r"^\s*(with|select)\b", re.IGNORECASE)
_FORBIDDEN = re.compile(r"\b(insert|alter|drop|delete|update|create|truncate|attach)\b", re.IGNORECASE)


@tool(name="clickhouse_query", show_result=True)
def clickhouse_query(sql: str) -> list[dict[str, Any]]:
    """Run a READ-ONLY SQL query over the tenant's ClickHouse events datalake.

    The query is automatically constrained to the caller's tenant — rows belonging to
    other tenants are never returned. Only ``SELECT`` / ``WITH`` statements are allowed.
    Useful tables: ``events`` (normalized security events) and ``detections``. Prefer
    filtering by ``ts`` and aggregating. Returns rows as a list of dicts.

    Args:
        sql: A single read-only SELECT/WITH statement over ``events``/``detections``.
    """
    if not _READONLY.match(sql) or _FORBIDDEN.search(sql):
        raise PermissionDeniedError(
            "clickhouse_query allows a single read-only SELECT/WITH statement only"
        )
    tenant_id = current_tenant_id()
    backend = clickhouse_for_tenant(tenant_id, get_settings())
    return backend.query(sql, tenant_id=tenant_id)
