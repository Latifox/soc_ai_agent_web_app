"""Execute and backtest detection rules against OpenSearch (tenant-scoped).

OpenSearch speaks Lucene natively, so a rule's ``query`` (ECS field names) is sent as a
``query_string`` with a time-window filter — no SQL translation. ``query`` rules return
matching events; ``advanced_threshold`` rules run a terms aggregation on the group-by field
and keep the buckets whose metric breaches the threshold. Events are read from the tenant's
``t-{tenant}-events`` indices via :func:`aegis_core.opensearch_for_tenant`.
"""

from __future__ import annotations

import operator
import re
from typing import Any

from aegis_core import get_settings, opensearch_for_tenant
from aegis_detection.schema import Rule, Threshold

_OPS = {">": operator.gt, ">=": operator.ge, "<": operator.lt, "<=": operator.le, "==": operator.eq}


def window_clause(depth: str) -> str:
    """Turn a rule ``depth`` into an OpenSearch date-math window (``now-<window>``)."""
    text = str(depth).strip()
    if re.fullmatch(r"\d+", text):  # bare number → seconds
        return f"now-{text}s"
    if re.fullmatch(r"\d+\s*[smhdwMy]", text):
        return f"now-{text.replace(' ', '')}"
    return "now-15m"


def _base_query(rule: Rule) -> dict[str, Any]:
    query = (rule.query or "*").strip() or "*"
    return {
        "bool": {
            "must": [{"query_string": {"query": query, "analyze_wildcard": True}}],
            "filter": [{"range": {"@timestamp": {"gte": window_clause(rule.depth)}}}],
        }
    }


def _metric_agg(aggregate: str) -> tuple[dict[str, Any] | None, str]:
    """Return ``(sub_agg, mode)`` for a threshold aggregate spec.

    ``mode`` is ``"doc_count"`` (bucket size) or ``"value"`` (a metric sub-agg named ``m``).
    """
    aggregate = aggregate.strip()
    if re.fullmatch(r"count\(\s*\)", aggregate) or re.fullmatch(r"count\([\w.]+\)", aggregate):
        return None, "doc_count"
    if m := re.fullmatch(r"(?:cardinality|count_distinct)\(([\w.]+)\)", aggregate):
        return {"m": {"cardinality": {"field": m.group(1)}}}, "value"
    if m := re.fullmatch(r"(?:sum|avg|max|min)\(([\w.]+)\)", aggregate):
        fn = aggregate.split("(", 1)[0]
        return {"m": {fn: {"field": m.group(1)}}}, "value"
    return None, "doc_count"


def run_rule(rule: Rule | dict, *, tenant_id: str, client: Any = None) -> dict[str, Any]:
    """Evaluate ``rule`` over the tenant's OpenSearch events.

    Returns ``{"matches": int, "breaches": [{"entities": [...], "metric": n}], "sample": [...]}``.
    """
    if isinstance(rule, dict):
        rule = Rule.from_yaml_obj(rule)
    os_client = client or opensearch_for_tenant(tenant_id, get_settings())
    query = _base_query(rule)

    if rule.type == "advanced_threshold":
        th = rule.threshold or Threshold()
        group_field = th.group_by[0] if th.group_by else "host.name"
        sub_agg, mode = _metric_agg(th.aggregate)
        terms: dict[str, Any] = {"terms": {"field": group_field, "size": 1000}}
        if sub_agg:
            terms["aggs"] = sub_agg
        aggs = os_client.aggregate(query, {"groups": terms}, tenant_id=tenant_id)
        buckets = aggs.get("groups", {}).get("buckets", [])
        cmp = _OPS.get(th.operator, operator.gt)
        breaches: list[dict[str, Any]] = []
        for b in buckets:
            metric = b.get("m", {}).get("value") if mode == "value" else b.get("doc_count", 0)
            metric = int(metric or 0)
            if cmp(metric, th.value):
                breaches.append({"entities": [str(b.get("key"))], "metric": metric})
        return {"matches": len(breaches), "breaches": breaches, "sample": breaches[:20]}

    # query / source_monitor / threat_match → matching events
    hits = os_client.search(query, tenant_id=tenant_id, size=200)
    return {"matches": len(hits), "breaches": [], "sample": hits[:20]}


def backtest(rule: Rule | dict, *, days: int = 30, tenant_id: str) -> dict[str, Any]:
    """Run ``rule`` over the last ``days`` (overrides depth). Returns a match summary."""
    data = rule.model_dump() if isinstance(rule, Rule) else dict(rule)
    data["depth"] = f"{days}d"
    result = run_rule(data, tenant_id=tenant_id)
    return {"matches": result["matches"], "sample": result["sample"], "note": None}
