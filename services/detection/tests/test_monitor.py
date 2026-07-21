"""Rule → OpenSearch Alerting monitor compilation."""

from __future__ import annotations

from aegis_detection.monitor import rule_to_monitor


def test_rule_to_monitor_shape() -> None:
    rule = {
        "title": "Brute Force Detection",
        "severity": "high",
        "type": "advanced_threshold",
        "query": "event.action:failed_login",
        "depth": 600,
        "frequency": "15m",
        "enabled": True,
        "threshold": {"group_by": ["source.ip"], "aggregate": "count(event.action)", "operator": "gt", "value": 5},
    }
    m = rule_to_monitor(rule, tenant_id="t1")
    assert m["monitor_type"] == "query_level_monitor"
    assert m["name"] == "Brute Force Detection"
    assert m["schedule"]["period"] == {"unit": "MINUTES", "interval": 15}
    assert m["inputs"][0]["search"]["indices"] == ["t-t1-events"]
    # Lucene query becomes a query_string filter; trigger fires above the threshold.
    filters = m["inputs"][0]["search"]["query"]["query"]["bool"]["filter"]
    assert any("query_string" in f for f in filters)
    assert m["triggers"][0]["query_level_trigger"]["condition"]["script"]["source"].endswith("> 5")
    assert m["triggers"][0]["query_level_trigger"]["severity"] == "2"  # high
