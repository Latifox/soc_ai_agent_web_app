"""Local filesystem storage backend (dev, no S3).

Objects are written under ``<base>/tenant=<tenant_id>/<key>`` so tenants are hard
separated on disk, matching the layout in ``docs/04-data-and-tenancy.md`` §3. Keys
are resolved and containment-checked to reject path traversal (``../``).
"""

from __future__ import annotations

from pathlib import Path

from aegis_core.errors import NotFoundError, StorageError

_ILLEGAL_TENANT = {"", ".", ".."}


def _validate_tenant_id(tenant_id: str) -> None:
    if tenant_id in _ILLEGAL_TENANT or any(sep in tenant_id for sep in ("/", "\\")):
        raise StorageError(f"invalid tenant_id for storage: {tenant_id!r}")


class LocalStorage:
    """Tenant-prefixed object store backed by the local filesystem."""

    def __init__(self, base_path: str | Path) -> None:
        self._base = Path(base_path)

    def _tenant_root(self, tenant_id: str) -> Path:
        _validate_tenant_id(tenant_id)
        return (self._base / f"tenant={tenant_id}").resolve()

    def _resolve(self, tenant_id: str, key: str) -> Path:
        root = self._tenant_root(tenant_id)
        target = (root / key.lstrip("/\\")).resolve()
        if target != root and not target.is_relative_to(root):
            raise StorageError(f"path traversal detected for key {key!r}")
        return target

    def put(self, tenant_id: str, key: str, data: bytes) -> str:
        target = self._resolve(tenant_id, key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return target.as_uri()

    def get(self, tenant_id: str, key: str) -> bytes:
        target = self._resolve(tenant_id, key)
        if not target.is_file():
            raise NotFoundError(f"object not found: tenant={tenant_id} key={key}")
        return target.read_bytes()

    def exists(self, tenant_id: str, key: str) -> bool:
        return self._resolve(tenant_id, key).is_file()

    def delete(self, tenant_id: str, key: str) -> None:
        target = self._resolve(tenant_id, key)
        target.unlink(missing_ok=True)

    def list(self, tenant_id: str, prefix: str = "") -> list[str]:
        root = self._tenant_root(tenant_id)
        if not root.is_dir():
            return []
        keys: list[str] = []
        for path in sorted(root.rglob("*")):
            if path.is_file():
                key = path.relative_to(root).as_posix()
                if key.startswith(prefix):
                    keys.append(key)
        return keys
