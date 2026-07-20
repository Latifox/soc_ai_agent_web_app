"""RBAC dependency — permission checks on top of the tenant context.

``require_permission("rules:write")`` yields a FastAPI dependency that resolves the
tenant context (which authenticates + scopes the request) and additionally asserts the
principal holds the permission. Data-layer RLS remains the backstop.
"""

from __future__ import annotations

from collections.abc import Callable

from aegis_core import TenantContext
from aegis_core.errors import PermissionDeniedError

from apps.api.deps import CurrentTenant


def require_permission(permission: str) -> Callable[[TenantContext], TenantContext]:
    """Return a dependency that requires ``permission`` on the active principal."""

    def _dep(tenant: CurrentTenant) -> TenantContext:
        if not tenant.has_permission(permission):
            raise PermissionDeniedError(f"missing permission: {permission}")
        return tenant

    return _dep
