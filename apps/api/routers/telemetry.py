"""Telemetry API — live aggregates from the tenant's OpenSearch logs.

Powers the dashboard's real-data panels: event volume, ingest timeline, and top
sources/categories come straight from the tenant's ``t-{tenant}-*`` indices via
:func:`aegis_core.opensearch_for_tenant`. When OpenSearch is unreachable (or empty) the
endpoint degrades to ``available: false`` with empty series so the dashboard renders a real
"connect a source" state instead of failing.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter

from aegis_core import get_logger, get_settings, opensearch_for_tenant

from apps.api.deps import CurrentTenant

log = get_logger(__name__)
router = APIRouter(prefix="/telemetry", tags=["telemetry"])

_WINDOW_HOURS = 24


def _empty(reason: str) -> dict[str, Any]:
    return {
        "available": False,
        "reason": reason,
        "window_hours": _WINDOW_HOURS,
        "total_events": 0,
        "peak_per_hour": 0,
        "timeline": [],
        "top_sources": [],
        "top_categories": [],
        "threat_signals": [],
    }


def _densify(buckets: list[dict[str, Any]], hours: int) -> list[dict[str, Any]]:
    """Continuous per-hour series (missing hours filled with 0), keyed by ``YYYY-MM-DD HH``."""
    counts = {str(b.get("key_as_string", ""))[:13].replace("T", " "): int(b.get("doc_count", 0)) for b in buckets}
    now_hour = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    series: list[dict[str, Any]] = []
    for i in range(hours - 1, -1, -1):
        slot = now_hour - timedelta(hours=i)
        key = slot.strftime("%Y-%m-%d %H")
        series.append({"bucket": slot.strftime("%Y-%m-%d %H:%M:%S"), "label": slot.strftime("%H:%M"), "count": counts.get(key, 0)})
    return series


@router.get("/overview")
async def telemetry_overview(tenant: CurrentTenant) -> dict[str, Any]:
    """Live event telemetry for the dashboard, sourced from the tenant's OpenSearch."""
    client = opensearch_for_tenant(tenant.tenant_id, get_settings())
    query = {"range": {"@timestamp": {"gte": f"now-{_WINDOW_HOURS}h"}}}
    aggs = {
        "timeline": {"date_histogram": {"field": "@timestamp", "fixed_interval": "1h", "min_doc_count": 0}},
        "sources": {"terms": {"field": "source_tool", "size": 6}},
        "categories": {"terms": {"field": "event.category", "size": 6}},
        "total": {"value_count": {"field": "@timestamp"}},
        # Security signals — filter aggs over the raw message text (attacker detail lives there,
        # not always in structured fields) so brute-force / recon activity surfaces on the dashboard.
        "threats": {
            "filters": {
                "filters": {
                    "auth_failures": {"bool": {"should": [{"match_phrase": {"message": "authentication failure"}}, {"match_phrase": {"message": "Failed password"}}], "minimum_should_match": 1}},
                    "invalid_user": {"match_phrase": {"message": "invalid user"}},
                    "connection_denied": {"bool": {"should": [{"match_phrase": {"message": "refused"}}, {"match_phrase": {"message": "denied"}}], "minimum_should_match": 1}},
                    "sudo_root": {"match_phrase": {"message": "sudo"}},
                },
            }
        },
    }
    try:
        result = client.aggregate(query, aggs, tenant_id=tenant.tenant_id)
    except Exception as exc:  # noqa: BLE001 - unreachable store is a real UI state
        log.info("telemetry.unavailable", tenant_id=tenant.tenant_id, error=str(exc)[:200])
        return _empty("OpenSearch not connected or unreachable")

    if not result:
        return _empty("no events in the window")

    series = _densify(result.get("timeline", {}).get("buckets", []), _WINDOW_HOURS)
    total = int(result.get("total", {}).get("value", 0))
    # Named filter buckets → threat signal counts (drop the catch-all + empty buckets).
    _THREAT_LABELS = {
        "auth_failures": "Auth failures",
        "invalid_user": "Invalid users",
        "connection_denied": "Denied / refused",
        "sudo_root": "Privilege / sudo",
    }
    threat_buckets = result.get("threats", {}).get("buckets", {}) or {}
    threat_signals = [
        {"key": key, "name": label, "count": int(threat_buckets.get(key, {}).get("doc_count", 0))}
        for key, label in _THREAT_LABELS.items()
        if int(threat_buckets.get(key, {}).get("doc_count", 0)) > 0
    ]
    threat_signals.sort(key=lambda s: s["count"], reverse=True)
    return {
        "available": True,
        "window_hours": _WINDOW_HOURS,
        "total_events": total,
        "peak_per_hour": max((b["count"] for b in series), default=0),
        "timeline": series,
        "top_sources": [{"name": str(b.get("key") or "unknown"), "count": int(b.get("doc_count", 0))} for b in result.get("sources", {}).get("buckets", [])],
        "top_categories": [{"name": str(b.get("key") or "unknown"), "count": int(b.get("doc_count", 0))} for b in result.get("categories", {}).get("buckets", [])],
        "threat_signals": threat_signals,
    }
