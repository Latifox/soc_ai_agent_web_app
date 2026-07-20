"""Tests for the tenant-prefixed LocalStorage backend."""

from __future__ import annotations

import pytest

from aegis_core.errors import NotFoundError, StorageError
from aegis_core.settings import Settings
from aegis_core.storage import LocalStorage, get_storage


def test_put_get_round_trip(tmp_path):
    store = LocalStorage(tmp_path)
    uri = store.put("acme", "reports/r1.txt", b"hello")
    assert uri.startswith("file://")
    assert store.get("acme", "reports/r1.txt") == b"hello"


def test_object_written_under_tenant_prefix(tmp_path):
    store = LocalStorage(tmp_path)
    store.put("acme", "a.txt", b"x")
    assert (tmp_path / "tenant=acme" / "a.txt").is_file()


def test_tenant_isolation_across_prefixes(tmp_path):
    store = LocalStorage(tmp_path)
    store.put("tenant-a", "secret.txt", b"a-data")
    assert not store.exists("tenant-b", "secret.txt")
    with pytest.raises(NotFoundError):
        store.get("tenant-b", "secret.txt")


def test_exists_delete_and_list(tmp_path):
    store = LocalStorage(tmp_path)
    store.put("acme", "logs/1.txt", b"1")
    store.put("acme", "logs/2.txt", b"2")
    store.put("acme", "reports/r.txt", b"r")
    assert store.exists("acme", "logs/1.txt")
    assert store.list("acme", prefix="logs/") == ["logs/1.txt", "logs/2.txt"]
    store.delete("acme", "logs/1.txt")
    assert not store.exists("acme", "logs/1.txt")
    store.delete("acme", "logs/1.txt")  # idempotent


def test_get_missing_raises_not_found(tmp_path):
    store = LocalStorage(tmp_path)
    with pytest.raises(NotFoundError):
        store.get("acme", "nope.txt")


def test_path_traversal_rejected(tmp_path):
    store = LocalStorage(tmp_path)
    with pytest.raises(StorageError):
        store.put("acme", "../../escape.txt", b"x")


def test_invalid_tenant_rejected(tmp_path):
    store = LocalStorage(tmp_path)
    with pytest.raises(StorageError):
        store.put("../evil", "a.txt", b"x")


def test_get_storage_selects_local(tmp_path):
    settings = Settings(storage_backend="local", storage_local_path=str(tmp_path))
    store = get_storage(settings)
    assert isinstance(store, LocalStorage)


def test_get_storage_unimplemented_backend(tmp_path):
    settings = Settings(storage_backend="s3", storage_local_path=str(tmp_path))
    with pytest.raises(NotImplementedError):
        get_storage(settings)
