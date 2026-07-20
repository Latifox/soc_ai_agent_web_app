"""Environment-variable secrets backend (dev).

Secrets are keyed ``AEGIS_SECRET__<TENANT>__<NAME>`` (upper-cased, non-alphanumerics
folded to ``_``) so they are tenant-namespaced and never collide across tenants.
Suitable for local dev only — production uses Vault/KMS behind the same protocol.
"""

from __future__ import annotations

import os
import re

from aegis_core.errors import SecretsError

_PREFIX = "AEGIS_SECRET"
_SANITIZE = re.compile(r"[^A-Za-z0-9]+")


def _slug(value: str, *, field: str) -> str:
    if not value or not value.strip():
        raise SecretsError(f"{field} must be a non-empty string")
    return _SANITIZE.sub("_", value.strip()).strip("_").upper()


def _env_key(tenant_id: str, name: str) -> str:
    return f"{_PREFIX}__{_slug(tenant_id, field='tenant_id')}__{_slug(name, field='name')}"


class EnvSecrets:
    """Read/write tenant-scoped secrets from the process environment."""

    def get_secret(self, tenant_id: str, name: str) -> str | None:
        return os.environ.get(_env_key(tenant_id, name))

    def set_secret(self, tenant_id: str, name: str, value: str) -> None:
        os.environ[_env_key(tenant_id, name)] = value

    def delete_secret(self, tenant_id: str, name: str) -> None:
        os.environ.pop(_env_key(tenant_id, name), None)
