"""Compile rules to ClickHouse SQL.

Translates the KQL/Lucene-style query language (over ECS field names) into a ClickHouse
``WHERE`` expression and assembles a full statement per rule type. This is a pragmatic
MVP translator covering the common forms in ``docs/06``: ``field:value``,
``field:(a OR b)``, ``field:[a TO b]``, wildcards, and ``AND``/``OR``/``NOT``. ``code``
and ``spark`` rules are executed by their own runners, not here.

Tenant scoping is applied by the ClickHouse adapter at query time (it wraps the SQL and
binds ``aegis_tenant``); every compiled statement therefore exposes ``tenant_id``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from aegis_detection.schema import Rule, Threshold

_FIELD_MAP = {
    "event.category": "event_category",
    "event.type": "event_type",
    "event.action": "event_action",
    "source.ip": "toString(src_ip)",
    "destination.ip": "toString(dst_ip)",
    "destination.port": "dst_port",
    "host.name": "host_name",
    "user.name": "user_name",
}
_NUMERIC_COLS = {"dst_port"}
_DUR_UNITS = {"s": "SECOND", "m": "MINUTE", "h": "HOUR", "d": "DAY"}


@dataclass(frozen=True, slots=True)
class CompiledRule:
    """A rule compiled to an executable ClickHouse statement."""

    rule_id: str | None
    type: str
    sql: str


def parse_duration(text: str) -> str:
    """Turn ``15m`` / ``1h`` / ``30 DAY`` into a ClickHouse ``INTERVAL`` clause."""
    text = str(text).strip()
    if m := re.fullmatch(r"(\d+)\s*([smhd])", text):
        return f"INTERVAL {int(m.group(1))} {_DUR_UNITS[m.group(2)]}"
    if m := re.fullmatch(r"(\d+)\s+(SECOND|MINUTE|HOUR|DAY)", text, re.IGNORECASE):
        return f"INTERVAL {int(m.group(1))} {m.group(2).upper()}"
    if m := re.fullmatch(r"(\d+)", text):  # bare number → seconds (e.g. depth: 600)
        return f"INTERVAL {int(m.group(1))} SECOND"
    raise ValueError(f"unrecognized duration: {text!r}")


def _col(field: str) -> str:
    return _FIELD_MAP.get(field, f"JSONExtractString(ecs, '{field}')")


def _is_num(value: str) -> bool:
    return re.fullmatch(r"-?\d+(\.\d+)?", value) is not None


def _lit(value: str) -> str:
    value = value.strip().strip('"').strip("'")
    return value if _is_num(value) else "'" + value.replace("'", "''") + "'"


def _term(field: str, value: str) -> str:
    column = _col(field)
    value = value.strip().strip('"').strip("'")
    if "*" in value:
        return f"{column} LIKE '{value.replace('*', '%').replace(chr(39), chr(39) * 2)}'"
    if field in _NUMERIC_COLS or _is_num(value):
        return f"{column} = {value if _is_num(value) else _lit(value)}"
    return f"{column} = {_lit(value)}"


def _range_repl(m: re.Match[str]) -> str:
    field, lo, hi = m.group(1), m.group(2).strip(), m.group(3).strip()
    column = _col(field)
    parts = []
    if lo != "*":
        parts.append(f"{column} >= {_lit(lo)}")
    if hi != "*":
        parts.append(f"{column} <= {_lit(hi)}")
    return "(" + " AND ".join(parts or ["1"]) + ")"


def _group_repl(m: re.Match[str]) -> str:
    field, inner = m.group(1), m.group(2)
    values = [v.strip().strip('"').strip("'") for v in re.split(r"\bOR\b", inner, flags=re.IGNORECASE)]
    column = _col(field)
    return f"{column} IN ({', '.join(_lit(v) for v in values)})"


def translate_query(query: str) -> str:
    """Translate a KQL/Lucene query string into a ClickHouse WHERE expression."""
    if not query or not query.strip():
        return "1"
    s = query.strip()
    s = re.sub(r"([\w.]+):\[\s*(.+?)\s+TO\s+(.+?)\s*\]", _range_repl, s)
    s = re.sub(r"([\w.]+):\(([^)]*)\)", _group_repl, s)
    s = re.sub(r'([\w.]+):("[^"]*"|\S+)', lambda m: _term(m.group(1), m.group(2)), s)
    return s


def _translate_agg(aggregate: str) -> str:
    aggregate = aggregate.strip()
    if m := re.fullmatch(r"cardinality\(([\w.]+)\)", aggregate):
        return f"uniqExact({_col(m.group(1))})"
    if re.fullmatch(r"count\(\s*\)", aggregate):
        return "count()"
    if m := re.fullmatch(r"count\(([\w.]+)\)", aggregate):  # count(event.action) → count(col)
        return f"count({_col(m.group(1))})"
    if m := re.fullmatch(r"count_distinct\(([\w.]+)\)", aggregate):
        return f"uniqExact({_col(m.group(1))})"
    return aggregate


def _threshold_sql(rule: Rule, where: str, time_filter: str) -> str:
    th = rule.threshold or Threshold()
    group_cols = [_col(f) for f in th.group_by]
    # Alias each group column to g0/g1/… so callers get a stable entity column name.
    select_group = "".join(f", {col} AS g{i}" for i, col in enumerate(group_cols))
    group_by = ", ".join(["tenant_id", *(f"g{i}" for i in range(len(group_cols)))]) if group_cols else "tenant_id"
    agg = _translate_agg(th.aggregate)
    return (
        f"SELECT tenant_id{select_group}, {agg} AS metric "
        f"FROM events WHERE ({where}) AND {time_filter} "
        f"GROUP BY {group_by} "
        f"HAVING metric {th.operator} {th.value}"
    )


def compile_rule(rule: Rule | dict, *, window: str | None = None) -> CompiledRule:
    """Compile a rule (or parsed-YAML mapping) to a ClickHouse statement."""
    if isinstance(rule, dict):
        rule = Rule.from_yaml_obj(rule)
    where = translate_query(rule.query or "")
    time_filter = f"ts >= now() - {parse_duration(window or rule.depth)}"
    if rule.type == "advanced_threshold":
        sql = _threshold_sql(rule, where, time_filter)
    elif rule.type in ("query", "source_monitor", "threat_match"):
        sql = f"SELECT * FROM events WHERE ({where}) AND {time_filter}"
    else:
        raise NotImplementedError(f"{rule.type!r} rules run in their own runner, not the SQL compiler")
    return CompiledRule(rule_id=rule.rule_id, type=rule.type, sql=sql)
