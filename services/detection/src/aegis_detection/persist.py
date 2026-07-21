"""Persist correlated incidents to Supabase Postgres.

Sets ``app.current_tenant`` on the connection so RLS applies, then inserts incidents.
Called by the runtime after :func:`aegis_detection.correlate`. ``psycopg`` is imported
lazily so importing this module never requires a database driver.
"""

from __future__ import annotations

from typing import Any

from aegis_core import get_logger, get_settings

log = get_logger(__name__)


def _title(incident: dict[str, Any]) -> str:
    entities = incident.get("entities") or []
    base = f"Detection cluster ({incident.get('detection_count', 0)} hits)"
    return f"{base} — {entities[0]}" if entities else base


def persist_incidents(incidents: list[dict[str, Any]], *, tenant_id: str) -> int:
    """Insert incident candidates for ``tenant_id``; returns the number written."""
    if not incidents:
        return 0
    import psycopg  # noqa: PLC0415

    dsn = get_settings().pg_url.replace("postgresql+psycopg://", "postgresql://")
    written = 0
    with psycopg.connect(dsn, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute("SET app.current_tenant = %s", (tenant_id,))
        for incident in incidents:
            cur.execute(
                "INSERT INTO incidents (tenant_id, title, severity, correlation_key, tags) "
                "VALUES (%s, %s, %s, %s, %s)",
                (
                    tenant_id,
                    _title(incident),
                    incident.get("severity", "medium"),
                    incident.get("correlation_key"),
                    incident.get("entities", []),
                ),
            )
            written += 1
    log.info("incidents.persist", tenant_id=tenant_id, count=written)
    return written
