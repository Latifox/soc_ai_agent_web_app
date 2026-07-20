"""Storage backend protocol.

All backends are tenant-scoped: every method takes ``tenant_id`` explicitly and the
backend is responsible for namespacing objects so no tenant can read another's data.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class StorageBackend(Protocol):
    """A tenant-scoped blob store (raw-log archive, case artifacts, reports)."""

    def put(self, tenant_id: str, key: str, data: bytes) -> str:
        """Write ``data`` at ``key`` for ``tenant_id``; return the storage URI."""
        ...

    def get(self, tenant_id: str, key: str) -> bytes:
        """Read the object at ``key`` for ``tenant_id`` (raises if missing)."""
        ...

    def exists(self, tenant_id: str, key: str) -> bool:
        """Return whether an object exists at ``key`` for ``tenant_id``."""
        ...

    def delete(self, tenant_id: str, key: str) -> None:
        """Delete the object at ``key`` for ``tenant_id`` (no-op if missing)."""
        ...

    def list(self, tenant_id: str, prefix: str = "") -> list[str]:
        """List object keys for ``tenant_id`` under an optional ``prefix``."""
        ...
