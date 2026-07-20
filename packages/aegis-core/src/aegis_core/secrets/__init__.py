"""Secrets abstraction (connector creds, API keys), namespaced per tenant.

Dev uses the :class:`~aegis_core.secrets.env.EnvSecrets` backend (process
environment). Prod backends (Vault / cloud KMS) implement the same
:class:`SecretsBackend` protocol — see task INFRA-07.
"""

from __future__ import annotations

from aegis_core.secrets.base import SecretsBackend
from aegis_core.secrets.env import EnvSecrets
from aegis_core.settings import Settings

__all__ = ["EnvSecrets", "SecretsBackend", "get_secrets"]


def get_secrets(settings: Settings) -> SecretsBackend:
    """Return the configured secrets backend.

    Only the ``env`` (dev) backend exists today; Vault/KMS arrive with the prod
    hardening work. ``settings`` is accepted now so call sites stay stable.
    """
    _ = settings
    return EnvSecrets()
