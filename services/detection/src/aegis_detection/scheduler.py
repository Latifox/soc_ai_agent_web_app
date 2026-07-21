"""Detection scheduler — run enabled rules per tenant and summarize matches.

MVP callable the runtime (APScheduler/Temporal) drives on each rule's ``frequency``.
``learning_mode`` rules run but do not alert. Emitting rows into the ``detections`` table
is the next step (needs a write path; the adapter is read-only by design).
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from aegis_core import get_logger
from aegis_detection.run import run_rule
from aegis_detection.schema import Rule

log = get_logger(__name__)


def run_one(rule: Rule | dict, *, tenant_id: str) -> dict[str, Any]:
    """Run a single rule against OpenSearch; return a match summary (no alert if learning)."""
    parsed = rule if isinstance(rule, Rule) else Rule.from_yaml_obj(rule)
    result = run_rule(parsed, tenant_id=tenant_id)
    # Threshold rules report breaches (entities per bucket); query rules report event hits.
    if result["breaches"]:
        rows = result["breaches"]
        entities = sorted({e for b in result["breaches"] for e in b.get("entities", [])})
    else:
        rows = [{"entities": [str(h.get("host", {}).get("name") or h.get("source", {}).get("ip") or "")]} for h in result["sample"]]
        entities = sorted({e for r in rows for e in r["entities"]} - {""})
    matches = result["matches"]
    summary = {
        "rule_id": parsed.rule_id,
        "type": parsed.type,
        "matches": matches,
        "alert": bool(matches) and not parsed.learning_mode,
        "learning_mode": parsed.learning_mode,
        "severity": parsed.severity,
        "entities": entities,
    }
    log.info("detection.run", tenant_id=tenant_id, **{k: summary[k] for k in ("rule_id", "matches", "alert")})
    if summary["alert"]:
        from aegis_detection.emit import emit_detection  # noqa: PLC0415

        summary["detection_id"] = emit_detection(
            tenant_id=tenant_id, rule_id=parsed.rule_id, severity=parsed.severity,
            rows=[{"entities": entities}],
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


def run_pipeline(rules: Iterable[Rule | dict], *, tenant_id: str) -> dict[str, Any]:
    """Full cycle: run rules -> correlate alerting detections -> persist incidents.

    Returns ``{summaries, incidents, persisted}``. Persistence failures degrade gracefully
    (incidents are still returned for the caller to retry/store elsewhere).
    """
    from aegis_detection.correlate import correlate  # noqa: PLC0415
    from aegis_detection.persist import persist_incidents  # noqa: PLC0415

    summaries = run_tenant(rules, tenant_id=tenant_id)
    alerting = [
        {
            "detection_id": s.get("detection_id"),
            "rule_id": s.get("rule_id"),
            "severity": s.get("severity", "medium"),
            "entities": s.get("entities", []),
        }
        for s in summaries
        if s.get("alert")
    ]
    incidents = correlate(alerting)
    try:
        persisted = persist_incidents(incidents, tenant_id=tenant_id) if incidents else 0
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("incidents.persist.failed", tenant_id=tenant_id, error=str(exc))
        persisted = 0
    return {"summaries": summaries, "incidents": incidents, "persisted": persisted}
