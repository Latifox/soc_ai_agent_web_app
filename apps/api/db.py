"""Postgres (Supabase) persistence — the durable backend for the metadata plane.

Everything the console shows (rules, incidents, cases, assets, integrations, approvals,
autonomy policies, reports, settings) is stored here as tenant-scoped JSONB documents in
``aegis.records`` / ``aegis.settings`` (see ``supabase/migrations/0001_aegis_core.sql``).
Telemetry / logs are NOT stored here — they live in OpenSearch.

``PgRepo`` mirrors the in-memory ``MemoryRepo`` API so routers are storage-agnostic. Every
statement filters by ``tenant_id`` (app-layer isolation) and sets the ``app.current_tenant``
GUC so the table's RLS policy applies as defense in depth.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from aegis_core import get_logger, get_settings

log = get_logger(__name__)

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Lazily open (and cache) the connection pool from ``PG_URL``."""
    global _pool  # noqa: PLW0603 - module-level singleton
    if _pool is None:
        dsn = get_settings().pg_dsn
        _pool = ConnectionPool(dsn, min_size=1, max_size=8, kwargs={"autocommit": True}, open=True)
        log.info("db.pool.open")
    return _pool


def _row_to_record(rec_id: uuid.UUID, data: dict[str, Any], created: datetime, updated: datetime) -> dict[str, Any]:
    return {
        **data,
        "id": str(rec_id),
        "created_at": created.isoformat() if created else None,
        "updated_at": updated.isoformat() if updated else None,
    }


class PgRepo:
    """Tenant-scoped JSONB document repo (one ``kind`` = one logical collection)."""

    def __init__(self, kind: str) -> None:
        self.kind = kind

    def _conn(self, tenant_id: str):  # noqa: ANN202 - psycopg connection context
        pool = get_pool()
        return pool.connection(), tenant_id

    def list(self, tenant_id: str) -> list[dict[str, Any]]:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select set_config('app.current_tenant', %s, false)", (tenant_id,))
            cur.execute(
                "select id, data, created_at, updated_at from aegis.records "
                "where tenant_id = %s and kind = %s order by updated_at desc",
                (tenant_id, self.kind),
            )
            return [_row_to_record(*r) for r in cur.fetchall()]

    def get(self, tenant_id: str, record_id: str) -> dict[str, Any] | None:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select set_config('app.current_tenant', %s, false)", (tenant_id,))
            cur.execute(
                "select id, data, created_at, updated_at from aegis.records "
                "where tenant_id = %s and kind = %s and id = %s",
                (tenant_id, self.kind, record_id),
            )
            row = cur.fetchone()
            return _row_to_record(*row) if row else None

    def create(self, tenant_id: str, record: dict[str, Any]) -> dict[str, Any]:
        record_id = str(record.get("id") or uuid.uuid4())
        data = {k: v for k, v in record.items() if k not in ("id", "tenant_id", "created_at", "updated_at")}
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select set_config('app.current_tenant', %s, false)", (tenant_id,))
            cur.execute(
                "insert into aegis.records (tenant_id, kind, id, data) values (%s, %s, %s, %s) "
                "returning id, data, created_at, updated_at",
                (tenant_id, self.kind, record_id, Jsonb(data)),
            )
            return _row_to_record(*cur.fetchone())

    def update(self, tenant_id: str, record_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        clean = {k: v for k, v in patch.items() if k not in ("id", "tenant_id", "created_at", "updated_at")}
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select set_config('app.current_tenant', %s, false)", (tenant_id,))
            cur.execute(
                "update aegis.records set data = data || %s, updated_at = now() "
                "where tenant_id = %s and kind = %s and id = %s "
                "returning id, data, created_at, updated_at",
                (Jsonb(clean), tenant_id, self.kind, record_id),
            )
            row = cur.fetchone()
            return _row_to_record(*row) if row else None

    def delete(self, tenant_id: str, record_id: str) -> bool:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select set_config('app.current_tenant', %s, false)", (tenant_id,))
            cur.execute(
                "delete from aegis.records where tenant_id = %s and kind = %s and id = %s",
                (tenant_id, self.kind, record_id),
            )
            return cur.rowcount > 0


class PgSettings:
    """Per-tenant settings document, merged over defaults (mirrors SettingsStore)."""

    def __init__(self, defaults: dict[str, Any], deep_merge: Any) -> None:
        self._defaults = defaults
        self._merge = deep_merge

    def get(self, tenant_id: str) -> dict[str, Any]:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select set_config('app.current_tenant', %s, false)", (tenant_id,))
            cur.execute("select data from aegis.settings where tenant_id = %s", (tenant_id,))
            row = cur.fetchone()
            return self._merge(self._defaults, row[0] if row else {})

    def update(self, tenant_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select set_config('app.current_tenant', %s, false)", (tenant_id,))
            cur.execute("select data from aegis.settings where tenant_id = %s", (tenant_id,))
            row = cur.fetchone()
            merged = self._merge(row[0] if row else {}, patch)
            cur.execute(
                "insert into aegis.settings (tenant_id, data) values (%s, %s) "
                "on conflict (tenant_id) do update set data = %s, updated_at = now()",
                (tenant_id, Jsonb(merged), Jsonb(merged)),
            )
            return self._merge(self._defaults, merged)


class PgTenants:
    """Cross-tenant onboarding directory (``aegis.tenants``)."""

    def list(self) -> list[dict[str, Any]]:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select id, name, status, opensearch_url, created_at from aegis.tenants order by created_at desc")
            return [
                {"id": str(r[0]), "name": r[1], "status": r[2], "opensearch_url": r[3], "created_at": r[4].isoformat() if r[4] else None}
                for r in cur.fetchall()
            ]

    def get(self, tenant_id: str) -> dict[str, Any] | None:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select id, name, status, opensearch_url from aegis.tenants where id = %s", (tenant_id,))
            r = cur.fetchone()
            return {"id": str(r[0]), "name": r[1], "status": r[2], "opensearch_url": r[3]} if r else None

    def create(self, tenant_id: str, name: str, opensearch_url: str | None) -> dict[str, Any]:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into aegis.tenants (id, name, opensearch_url) values (%s, %s, %s) returning id, name, status, opensearch_url",
                (tenant_id, name, opensearch_url),
            )
            r = cur.fetchone()
            return {"id": str(r[0]), "name": r[1], "status": r[2], "opensearch_url": r[3]}

    def update(self, tenant_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        allowed = {k: v for k, v in patch.items() if k in {"name", "status", "opensearch_url"} and v is not None}
        if not allowed:
            return self.get(tenant_id)
        sets = ", ".join(f"{k} = %s" for k in allowed)
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"update aegis.tenants set {sets} where id = %s returning id, name, status, opensearch_url",  # noqa: S608 - keys are allow-listed above
                (*allowed.values(), tenant_id),
            )
            r = cur.fetchone()
            return {"id": str(r[0]), "name": r[1], "status": r[2], "opensearch_url": r[3]} if r else None


def ping() -> bool:
    """True if the pool can round-trip a query (used at startup)."""
    try:
        with get_pool().connection() as conn, conn.cursor() as cur:
            cur.execute("select 1")
            return cur.fetchone()[0] == 1
    except Exception as exc:  # noqa: BLE001
        log.error("db.ping.failed", error=str(exc)[:200])
        return False


# Silence "imported but unused" for json (kept for callers/debug parity).
_ = json
