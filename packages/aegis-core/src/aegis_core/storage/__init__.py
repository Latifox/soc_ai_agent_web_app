"""Object storage abstraction.

Local-first: the default ``local`` backend writes tenant-prefixed objects under
``STORAGE_LOCAL_PATH`` (``./data/storage``) — no S3/MinIO required. ``supabase`` and
``s3`` backends are declared by the :class:`StorageBackend` protocol and land in a
later task; selecting them today raises :class:`NotImplementedError`.
"""

from __future__ import annotations

from aegis_core.settings import Settings
from aegis_core.storage.base import StorageBackend
from aegis_core.storage.local import LocalStorage

__all__ = ["LocalStorage", "StorageBackend", "get_storage"]


def get_storage(settings: Settings) -> StorageBackend:
    """Return the configured storage backend based on ``STORAGE_BACKEND``."""
    backend = settings.storage_backend
    if backend == "local":
        return LocalStorage(settings.storage_local_path)
    # supabase / s3 are part of the prod path — see docs/10-external-tools.md.
    raise NotImplementedError(f"storage backend '{backend}' is not implemented yet (local-first)")
