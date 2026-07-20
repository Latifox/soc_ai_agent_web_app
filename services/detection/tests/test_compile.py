"""Offline tests for the rule compiler (no ClickHouse required)."""

from __future__ import annotations

from aegis_detection import compile_rule
from aegis_detection.compile import parse_duration, translate_query


def test_translate_basic() -> None:
    out = translate_query("event.category:network AND event.action:accept")
    assert out == "event_category = 'network' AND event_action = 'accept'"


def test_translate_group_and_not() -> None:
    out = translate_query("NOT source.ip:(172.16.8.150 OR 172.16.8.50)")
    assert out.startswith("NOT ")
    assert "toString(src_ip) IN ('172.16.8.150', '172.16.8.50')" in out


def test_translate_range() -> None:
    out = translate_query("destination.port:[* TO 3014]")
    assert out == "(dst_port <= 3014)"


def test_parse_duration() -> None:
    assert parse_duration("15m") == "INTERVAL 15 MINUTE"
    assert parse_duration("1h") == "INTERVAL 1 HOUR"
    assert parse_duration("30 DAY") == "INTERVAL 30 DAY"


def test_compile_threshold() -> None:
    rule = {
        "title": "many protocols",
        "severity": "low",
        "type": "advanced_threshold",
        "query": "event.category:network",
        "depth": "1h",
        "threshold": {
            "group_by": ["source.ip"],
            "aggregate": "cardinality(destination.port)",
            "operator": ">",
            "value": 50,
        },
    }
    compiled = compile_rule(rule)
    assert "uniqExact(dst_port) AS metric" in compiled.sql
    assert "GROUP BY tenant_id, toString(src_ip)" in compiled.sql
    assert "HAVING metric > 50" in compiled.sql


def test_compile_query() -> None:
    compiled = compile_rule(
        {"title": "t", "severity": "high", "type": "query", "query": "user.name:jane.doe", "depth": "15m"}
    )
    assert compiled.sql.startswith("SELECT * FROM events WHERE (user_name = 'jane.doe')")
    assert "INTERVAL 15 MINUTE" in compiled.sql
