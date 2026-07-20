"""Write detections to ClickHouse.

The read adapter is intentionally SELECT-only, so emitting uses a backend-native session
(chdb locally, clickhouse-connect on a server). Values are escaped; tenant_id is validated
by the caller (scheduler passes the active tenant).
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from aegis_core import get_logger, get_settings

log = get_logger(__name__)


def _run_insert(sql: str) -> None:
    settings = get_settings()
    if settings.clickhouse_backend == "chdb":
        from chdb import session as chs  # noqa: PLC0415

        Path(settings.chdb_path).mkdir(parents=True, exist_ok=True)
        session = chs.Session(settings.chdb_path)
        session.query(sql)
        session.close()
    else:
        import clickhouse_connect  # noqa: PLC0415

        client = clickhouse_connect.get_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_port,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
        )
        client.command(sql)


def _q(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def emit_detection(*, tenant_id: str, rule_id: str | None, severity: str, rows: list[dict[str, Any]]) -> str:
    """Insert one detection summarizing a rule's matches. Returns the detection id."""
    detection_id = str(uuid.uuid4())
    entities = sorted({str(r.get("src_ip") or r.get("user_name") or "") for r in rows[:100]} - {""})
    fields = json.dumps({"matches": len(rows), "sample": rows[:5]}, default=str)
    ents = ", ".join(_q(e) for e in entities)
    sql = (
        "INSERT INTO aegis.detections "
        "(tenant_id, detection_id, rule_id, severity, entities, event_ids, fields) VALUES ("
        f"{_q(tenant_id)}, {_q(detection_id)}, {_q(rule_id or '')}, {_q(severity)}, "
        f"[{ents}], [], {_q(fields)})"
    )
    _run_insert(sql)
    log.info("detection.emit", tenant_id=tenant_id, rule_id=rule_id, detection_id=detection_id, matches=len(rows))
    return detection_id
