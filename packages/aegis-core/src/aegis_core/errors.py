"""Aegis error hierarchy.

Every application error derives from :class:`AegisError` and carries a stable
``code``, a human ``title`` and an ``http_status`` so the API layer can render an
RFC-9457 ``application/problem+json`` response without a translation table.
"""

from __future__ import annotations

from typing import Any


class AegisError(Exception):
    """Base class for all Aegis domain errors."""

    code: str = "internal_error"
    title: str = "Internal Server Error"
    http_status: int = 500

    def __init__(
        self,
        detail: str | None = None,
        *,
        http_status: int | None = None,
        code: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        self.detail = detail or self.title
        if http_status is not None:
            self.http_status = http_status
        if code is not None:
            self.code = code
        self.extra: dict[str, Any] = extra or {}
        super().__init__(self.detail)


class ConfigurationError(AegisError):
    """Invalid or missing configuration."""

    code = "configuration_error"
    title = "Configuration Error"
    http_status = 500


class TenantContextError(AegisError):
    """A tenant-scoped operation ran without a tenant context set."""

    code = "tenant_context_missing"
    title = "Tenant Context Missing"
    http_status = 500


class TenantIsolationError(AegisError):
    """An operation attempted to cross a tenant boundary."""

    code = "tenant_isolation_violation"
    title = "Tenant Isolation Violation"
    http_status = 400


class AuthError(AegisError):
    """Authentication failed (missing / invalid / expired credentials)."""

    code = "authentication_error"
    title = "Authentication Failed"
    http_status = 401


class PermissionDeniedError(AegisError):
    """The caller is authenticated but lacks the required permission."""

    code = "permission_denied"
    title = "Permission Denied"
    http_status = 403


class NotFoundError(AegisError):
    """A requested resource does not exist."""

    code = "not_found"
    title = "Not Found"
    http_status = 404


class StorageError(AegisError):
    """A storage-backend operation failed."""

    code = "storage_error"
    title = "Storage Error"
    http_status = 500


class SecretsError(AegisError):
    """A secrets-backend operation failed."""

    code = "secrets_error"
    title = "Secrets Error"
    http_status = 500
