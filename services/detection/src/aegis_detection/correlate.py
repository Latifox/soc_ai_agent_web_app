"""Correlate detections into incident candidates.

Clusters detections that share a rule + entity into a single incident so analysts (and
the Triage agent) work one item instead of N alerts. Pure logic — the runtime persists the
resulting incidents to the metadata store.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _sev_rank(severity: str) -> int:
    return _SEVERITY_RANK.get(severity, 0)


def correlation_key(detection: dict[str, Any]) -> str:
    """Group key: rule id + the detection's primary entity."""
    entities = sorted(detection.get("entities") or [])
    primary = entities[0] if entities else "none"
    return f"{detection.get('rule_id', '')}|{primary}"


def correlate(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Cluster detections into incident candidates."""
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for detection in detections:
        groups[correlation_key(detection)].append(detection)

    incidents: list[dict[str, Any]] = []
    for key, members in groups.items():
        severity = max((m.get("severity", "low") for m in members), key=_sev_rank)
        entities = sorted({e for m in members for e in (m.get("entities") or [])})
        incidents.append(
            {
                "correlation_key": key,
                "rule_id": members[0].get("rule_id"),
                "severity": severity,
                "detection_count": len(members),
                "entities": entities,
                "detection_ids": [m.get("detection_id") for m in members if m.get("detection_id")],
            }
        )
    return incidents
