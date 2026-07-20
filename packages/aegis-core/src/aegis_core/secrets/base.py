"""Secrets backend protocol — tenant-namespaced get/set/delete."""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class SecretsBackend(Protocol):
    """A tenant-scoped secret store."""

    def get_secret(self, tenant_id: str, name: str) -> str | None:
        """Return the secret ``name`` for ``tenant_id`` or ``None`` if absent."""
        ...

    def set_secret(self, tenant_id: str, name: str, value: str) -> None:
        """Store ``value`` as secret ``name`` for ``tenant_id``."""
        ...

    def delete_secret(self, tenant_id: str, name: str) -> None:
        """Delete secret ``name`` for ``tenant_id`` (no-op if absent)."""
        ...
