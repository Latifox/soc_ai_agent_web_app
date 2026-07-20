"""Execute and backtest compiled rules against ClickHouse (tenant-scoped)."""

from __future__ import annotations

from typing import Any

from aegis_core import get_clickhouse, get_settings
from aegis_detection.compile import CompiledRule, compile_rule
from aegis_detection.schema import Rule


def run_rule(compiled: CompiledRule, *, tenant_id: str) -> list[dict[str, Any]]:
    """Run a compiled rule; the adapter enforces tenant scope. Returns matching rows."""
    return get_clickhouse(get_settings()).query(compiled.sql, tenant_id=tenant_id)


def backtest(rule: Rule | dict, *, days: int = 30, tenant_id: str) -> dict[str, Any]:
    """Compile ``rule`` over the last ``days`` and run it. Returns a match summary."""
    compiled = compile_rule(rule, window=f"{days} DAY")
    rows = run_rule(compiled, tenant_id=tenant_id)
    return {"matches": len(rows), "sample": rows[:20], "sql": compiled.sql, "note": None}
