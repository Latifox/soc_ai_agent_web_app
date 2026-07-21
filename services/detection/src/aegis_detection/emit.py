"""Write detections to OpenSearch (``t-{tenant}-detections``)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from aegis_core import get_logger, get_settings, opensearch_for_tenant

log = get_logger(__name__)


def emit_detection(*, tenant_id: str, rule_id: str | None, severity: str, rows: list[dict[str, Any]]) -> str:
    """Index one detection summarizing a rule's matches. Returns the detection id."""
    detection_id = str(uuid.uuid4())
    entities = sorted({e for r in rows[:100] for e in (r.get("entities") or [])} - {""})
    doc = {
        "@timestamp": datetime.now(UTC).isoformat(),
        "detection_id": detection_id,
        "tenant_id": tenant_id,
        "rule_id": rule_id or "",
        "severity": severity,
        "entities": entities,
        "matches": len(rows),
    }
    client = opensearch_for_tenant(tenant_id, get_settings())
    client.index_doc(doc, tenant_id=tenant_id, suffix="detections", doc_id=detection_id)
    log.info("detection.emit", tenant_id=tenant_id, rule_id=rule_id, detection_id=detection_id, matches=len(rows))
    return detection_id
