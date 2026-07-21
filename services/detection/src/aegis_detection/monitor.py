"""Compile an Aegis rule into an OpenSearch Alerting monitor (query-level).

Deploying a rule creates a real monitor via ``POST _plugins/_alerting/monitors`` so it
shows up in OpenSearch Dashboards → Alerting → Monitors and fires on the tenant's live
logs. The rule's Lucene ``query`` becomes a ``query_string`` filter with a time window;
the trigger fires when matching hits breach the threshold.
"""

from __future__ import annotations

import re
from typing import Any

from aegis_detection.run import window_clause
from aegis_detection.schema import Rule

# OpenSearch Alerting severity is 1 (highest) … 5 (lowest).
_SEVERITY = {"critical": "1", "high": "2", "medium": "3", "low": "4"}
_UNITS = {"s": "SECONDS", "m": "MINUTES", "h": "HOURS", "d": "DAYS"}


def _period(frequency: str) -> dict[str, Any]:
    text = str(frequency).strip()
    if m := re.fullmatch(r"(\d+)\s*([smhd])", text):
        return {"unit": _UNITS[m.group(2)], "interval": int(m.group(1))}
    if re.fullmatch(r"\d+", text):
        return {"unit": "MINUTES", "interval": int(text)}
    return {"unit": "MINUTES", "interval": 5}


def rule_to_monitor(rule: Rule | dict, *, tenant_id: str) -> dict[str, Any]:
    """Build the OpenSearch monitor JSON for ``rule`` over the tenant's events index."""
    if isinstance(rule, dict):
        rule = Rule.from_yaml_obj(rule)
    indices = rule.indices or [f"t-{tenant_id}-events"]
    window = window_clause(rule.depth).replace("now-", "now-")  # e.g. now-600s
    threshold = int(rule.threshold.value) if rule.threshold else 0

    search_query = {
        "bool": {
            "filter": [
                {"range": {"@timestamp": {"from": window, "to": None, "include_lower": True, "include_upper": True}}},
                {"query_string": {"query": rule.query or "*", "analyze_wildcard": True}},
            ]
        }
    }
    return {
        "type": "monitor",
        "name": rule.title,
        "monitor_type": "query_level_monitor",
        "enabled": bool(rule.enabled),
        "schedule": {"period": _period(rule.frequency)},
        "inputs": [{"search": {"indices": indices, "query": {"size": 0, "query": search_query}}}],
        "triggers": [
            {
                "query_level_trigger": {
                    "name": rule.title,
                    "severity": _SEVERITY.get(rule.severity, "3"),
                    "condition": {
                        "script": {
                            "source": f"ctx.results[0].hits.total.value > {threshold}",
                            "lang": "painless",
                        }
                    },
                    "actions": [],
                }
            }
        ],
    }
