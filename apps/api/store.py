"""In-memory, tenant-scoped store (dev default).

Behaves like the RLS-backed Supabase store will (every read/write is filtered by the
active tenant), so routers are written once and the persistence swap (BE-02) is
transparent. Not for production — process-local and volatile.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from threading import RLock
from typing import Any


def _now() -> str:
    return datetime.now(UTC).isoformat()


class MemoryRepo:
    """A tenant-partitioned record store: ``tenant_id -> id -> record``."""

    def __init__(self) -> None:
        self._data: dict[str, dict[str, dict[str, Any]]] = {}
        self._lock = RLock()

    def list(self, tenant_id: str) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._data.get(tenant_id, {}).values())

    def get(self, tenant_id: str, record_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._data.get(tenant_id, {}).get(record_id)

    def create(self, tenant_id: str, record: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            record_id = str(record.get("id") or uuid.uuid4())
            stored = {**record, "id": record_id, "tenant_id": tenant_id, "created_at": _now()}
            self._data.setdefault(tenant_id, {})[record_id] = stored
            return stored

    def update(self, tenant_id: str, record_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        with self._lock:
            current = self._data.get(tenant_id, {}).get(record_id)
            if current is None:
                return None
            current.update({**patch, "updated_at": _now()})
            return current

    def delete(self, tenant_id: str, record_id: str) -> bool:
        with self._lock:
            return self._data.get(tenant_id, {}).pop(record_id, None) is not None


rules_repo = MemoryRepo()
incidents_repo = MemoryRepo()
cases_repo = MemoryRepo()
integrations_repo = MemoryRepo()
assets_repo = MemoryRepo()
approvals_repo = MemoryRepo()
autonomy_repo = MemoryRepo()
reports_repo = MemoryRepo()
