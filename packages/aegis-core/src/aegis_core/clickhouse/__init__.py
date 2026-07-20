"""ClickHouse adapter with backend selection and mandatory tenant scoping.

``CLICKHOUSE_BACKEND`` selects the implementation:

* ``chdb``   → in-process ClickHouse (local dev, default) — no server.
* ``server`` → a ClickHouse server via ``clickhouse-connect`` (staging/prod).

Both backends route through :func:`~aegis_core.clickhouse.adapter.build_tenant_scoped_query`
so **every** query is wrapped with a ``tenant_id`` filter; a query without a
``tenant_id`` is rejected. See ``docs/04-data-and-tenancy.md`` §3.2.
"""

from __future__ import annotations

from aegis_core.clickhouse.adapter import (
    ChdbClickHouse,
    ClickHouseBackend,
    ServerClickHouse,
    build_tenant_scoped_query,
    get_clickhouse,
)

__all__ = [
    "ChdbClickHouse",
    "ClickHouseBackend",
    "ServerClickHouse",
    "build_tenant_scoped_query",
    "get_clickhouse",
]
