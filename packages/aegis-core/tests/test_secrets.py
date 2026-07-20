"""Tests for the env-backed secrets abstraction (INFRA-07)."""

from __future__ import annotations

import pytest

from aegis_core.errors import SecretsError
from aegis_core.secrets import EnvSecrets, get_secrets
from aegis_core.settings import Settings


@pytest.fixture
def secrets(monkeypatch):
    # Isolate the process environment so keys do not leak across tests.
    monkeypatch.setattr("os.environ", {})
    return EnvSecrets()


def test_get_put_round_trip(secrets):
    assert secrets.get_secret("acme", "okta_token") is None
    secrets.set_secret("acme", "okta_token", "s3cr3t")
    assert secrets.get_secret("acme", "okta_token") == "s3cr3t"


def test_tenant_namespacing(secrets):
    secrets.set_secret("tenant-a", "api_key", "aaa")
    secrets.set_secret("tenant-b", "api_key", "bbb")
    assert secrets.get_secret("tenant-a", "api_key") == "aaa"
    assert secrets.get_secret("tenant-b", "api_key") == "bbb"


def test_delete(secrets):
    secrets.set_secret("acme", "k", "v")
    secrets.delete_secret("acme", "k")
    assert secrets.get_secret("acme", "k") is None
    secrets.delete_secret("acme", "k")  # idempotent


def test_empty_tenant_or_name_rejected(secrets):
    with pytest.raises(SecretsError):
        secrets.set_secret("", "k", "v")
    with pytest.raises(SecretsError):
        secrets.get_secret("acme", "")


def test_get_secrets_returns_env_backend():
    assert isinstance(get_secrets(Settings()), EnvSecrets)
