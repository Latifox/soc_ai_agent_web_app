"""Detection runner over OpenSearch — window math, aggregate mapping, threshold logic."""

from __future__ import annotations

from typing import Any

from aegis_detection.run import _metric_agg, run_rule, window_clause


def test_window_clause() -> None:
    assert window_clause("600") == "now-600s"  # bare number → seconds (Vibe output)
    assert window_clause("15m") == "now-15m"
    assert window_clause("1h") == "now-1h"
    assert window_clause("weird") == "now-15m"


def test_metric_agg_mapping() -> None:
    assert _metric_agg("count()") == (None, "doc_count")
    assert _metric_agg("count(event.action)") == (None, "doc_count")
    sub, mode = _metric_agg("cardinality(destination.port)")
    assert mode == "value" and sub == {"m": {"cardinality": {"field": "destination.port"}}}


class _FakeOS:
    """Stub OpenSearch client returning a single breaching bucket."""

    def aggregate(self, query: dict[str, Any], aggs: dict[str, Any], *, tenant_id: str) -> dict[str, Any]:
        return {"groups": {"buckets": [{"key": "203.0.113.66", "doc_count": 16}, {"key": "10.0.0.1", "doc_count": 2}]}}

    def search(self, query: dict[str, Any], *, tenant_id: str, size: int = 50) -> list[dict[str, Any]]:
        return []


def test_threshold_rule_flags_breaching_bucket() -> None:
    rule = {
        "title": "Brute Force Detection",
        "severity": "medium",
        "type": "advanced_threshold",
        "query": "event.action:failed_login",
        "depth": 600,
        "threshold": {"group_by": ["source.ip"], "aggregate": "count(event.action)", "operator": "gt", "value": 5},
    }
    result = run_rule(rule, tenant_id="t", client=_FakeOS())
    assert result["matches"] == 1
    assert result["breaches"][0]["entities"] == ["203.0.113.66"]
    assert result["breaches"][0]["metric"] == 16
