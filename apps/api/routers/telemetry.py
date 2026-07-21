"""Telemetry API — live aggregates from the tenant's connected data stores.

Powers the dashboard's real-data panels: event volume, ingest timeline, and top
sources/categories come straight from the tenant's ClickHouse datalake via
:func:`aegis_core.clickhouse_for_tenant`. When no ClickHouse connector is granted (or the
store is unreachable) the endpoint degrades to ``available: false`` with empty series so
the dashboard renders a real "connect a source" state instead of failing.

Every query is tenant-scoped by :func:`aegis_core.connectors` — each aggregate carries
``tenant_id`` in its ``GROUP BY`` so the scoping wrapper's outer filter applies.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from aegis_core import clickhouse_for_tenant, get_logger, get_settings

from apps.api.deps import CurrentTenant

log = get_logger(__name__)
router = APIRouter(prefix="/telemetry", tags=["telemetry"])

_WINDOW_HOURS = 24

_TOTAL = "SELECT tenant_id, count() AS c FROM events WHERE ts > now() - INTERVAL {h} HOUR GROUP BY tenant_id"
_TIMELINE = (
    "SELECT toStartOfHour(ts) AS bucket, tenant_id, count() AS c FROM events "
    "WHERE ts > now() - INTERVAL {h} HOUR GROUP BY bucket, tenant_id ORDER BY bucket"
)
_TOP_SOURCES = (
    "SELECT source AS name, tenant_id, count() AS c FROM events "
    "WHERE ts > now() - INTERVAL {h} HOUR GROUP BY source, tenant_id ORDER BY c DESC LIMIT 6"
)
_TOP_CATEGORIES = (
    "SELECT event_category AS name, tenant_id, count() AS c FROM events "
    "WHERE ts > now() - INTERVAL {h} HOUR GROUP BY event_category, tenant_id ORDER BY c DESC LIMIT 6"
)


def _empty(reason: str) -> dict[str, Any]:
    return {
        "available": False,
        "reason": reason,
        "window_hours": _WINDOW_HOURS,
        "total_events": 0,
        "timeline": [],
        "top_sources": [],
        "top_categories": [],
    }


@router.get("/overview")
async def telemetry_overview(tenant: CurrentTenant) -> dict[str, Any]:
    """Live event telemetry for the dashboard, sourced from the tenant's ClickHouse."""
    settings = get_settings()
    backend = clickhouse_for_tenant(tenant.tenant_id, settings)
    h = _WINDOW_HOURS

    def q(sql: str) -> list[dict[str, Any]]:
        return backend.query(sql.format(h=h), tenant_id=tenant.tenant_id)

    try:
        total_rows = q(_TOTAL)
        timeline = q(_TIMELINE)
        top_sources = q(_TOP_SOURCES)
        top_categories = q(_TOP_CATEGORIES)
    except Exception as exc:  # noqa: BLE001 - unreachable/unconfigured store is a real UI state
        log.info("telemetry.unavailable", tenant_id=tenant.tenant_id, error=str(exc)[:200])
        return _empty("ClickHouse not connected or unreachable")

    total = int(total_rows[0]["c"]) if total_rows else 0
    return {
        "available": True,
        "window_hours": h,
        "total_events": total,
        "timeline": [{"bucket": str(r.get("bucket")), "count": int(r.get("c", 0))} for r in timeline],
        "top_sources": [{"name": str(r.get("name") or "unknown"), "count": int(r.get("c", 0))} for r in top_sources],
        "top_categories": [{"name": str(r.get("name") or "unknown"), "count": int(r.get("c", 0))} for r in top_categories],
    }
