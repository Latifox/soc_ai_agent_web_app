"""Detection scheduler — run enabled rules per tenant and summarize matches.

MVP callable the runtime (APScheduler/Temporal) drives on each rule's ``frequency``.
``learning_mode`` rules run but do not alert. Emitting rows into the ``detections`` table
is the next step (needs a write path; the adapter is read-only by design).
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from aegis_core import get_logger
from aegis_detection.compile import compile_rule
from aegis_detection.run import run_rule
from aegis_detection.schema import Rule

log = get_logger(__name__)


def run_one(rule: Rule | dict, *, tenant_id: str) -> dict[str, Any]:
    """Compile + run a single rule; return a match summary (no alert if learning_mode)."""
    parsed = rule if isinstance(rule, Rule) else Rule.from_yaml_obj(rule)
    compiled = compile_rule(parsed)
    rows = run_rule(compiled, tenant_id=tenant_id)
    summary = {
        "rule_id": compiled.rule_id,
        "type": compiled.type,
        "matches": len(rows),
        "alert": bool(rows) and not parsed.learning_mode,
        "learning_mode": parsed.learning_mode,
    }
    log.info("detection.run", tenant_id=tenant_id, **{k: summary[k] for k in ("rule_id", "matches", "alert")})
    if summary["alert"]:
        from aegis_detection.emit import emit_detection  # noqa: PLC0415

        summary["detection_id"] = emit_detection(
            tenant_id=tenant_id, rule_id=compiled.rule_id, severity=parsed.severity, rows=rows
        )
    return summary


def run_tenant(rules: Iterable[Rule | dict], *, tenant_id: str) -> list[dict[str, Any]]:
    """Run every enabled rule for a tenant; skip disabled ones. Returns per-rule summaries."""
    results: list[dict[str, Any]] = []
    for rule in rules:
        parsed = rule if isinstance(rule, Rule) else Rule.from_yaml_obj(rule)
        if not parsed.enabled:
            continue
        results.append(run_one(parsed, tenant_id=tenant_id))
    return results
