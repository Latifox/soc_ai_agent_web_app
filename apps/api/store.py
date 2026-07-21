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


from aegis_core import get_settings  # noqa: E402

_KINDS = ("rule", "incident", "case", "integration", "asset", "approval", "autonomy_policy", "report", "conversation")


def _make_repos() -> dict[str, Any]:
    """Pick the metadata backend: durable Postgres (Supabase) or volatile in-memory."""
    if get_settings().persistence == "postgres":
        from apps.api.db import PgRepo  # noqa: PLC0415 - optional dependency

        return {k: PgRepo(k) for k in _KINDS}
    return {k: MemoryRepo() for k in _KINDS}


_repos = _make_repos()
rules_repo = _repos["rule"]
incidents_repo = _repos["incident"]
cases_repo = _repos["case"]
integrations_repo = _repos["integration"]
assets_repo = _repos["asset"]
approvals_repo = _repos["approval"]
autonomy_repo = _repos["autonomy_policy"]
reports_repo = _repos["report"]
conversations_repo = _repos["conversation"]


DEFAULT_SETTINGS: dict[str, Any] = {
    "org_name": "Aegis Demo",
    "timezone": "UTC",
    "contact_email": "",
    "preferences": {"incident_notifications": True, "daily_digest": False, "weekly_report": True},
    "detection": {"default_severity": "medium", "schedule_frequency": "15m", "retention_days": 90, "auto_close_fp": True},
}


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Return ``base`` overlaid with ``patch`` (nested dicts merged, not replaced)."""
    out = {**base}
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


class SettingsStore:
    """Single tenant-settings document per tenant, merged over :data:`DEFAULT_SETTINGS`."""

    def __init__(self) -> None:
        self._data: dict[str, dict[str, Any]] = {}
        self._lock = RLock()

    def get(self, tenant_id: str) -> dict[str, Any]:
        with self._lock:
            return _deep_merge(DEFAULT_SETTINGS, self._data.get(tenant_id, {}))

    def update(self, tenant_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            current = self._data.get(tenant_id, {})
            merged = _deep_merge(current, patch)
            self._data[tenant_id] = merged
            return _deep_merge(DEFAULT_SETTINGS, merged)


def _make_settings_store() -> Any:
    if get_settings().persistence == "postgres":
        from apps.api.db import PgSettings  # noqa: PLC0415

        return PgSettings(DEFAULT_SETTINGS, _deep_merge)
    return SettingsStore()


settings_store = _make_settings_store()


class MemoryTenants:
    """Volatile onboarding directory (dev/tests) — mirrors PgTenants."""

    def __init__(self) -> None:
        self._data: dict[str, dict[str, Any]] = {}
        self._lock = RLock()

    def list(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._data.values())

    def get(self, tenant_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._data.get(tenant_id)

    def create(self, tenant_id: str, name: str, opensearch_url: str | None) -> dict[str, Any]:
        with self._lock:
            row = {"id": tenant_id, "name": name, "status": "active", "opensearch_url": opensearch_url}
            self._data[tenant_id] = row
            return row


def _make_tenants_store() -> Any:
    if get_settings().persistence == "postgres":
        from apps.api.db import PgTenants  # noqa: PLC0415

        return PgTenants()
    return MemoryTenants()


tenants_store = _make_tenants_store()
