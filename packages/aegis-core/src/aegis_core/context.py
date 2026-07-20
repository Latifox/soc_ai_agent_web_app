"""Tenant context — the per-request/per-run tenant identity.

Every code path that touches tenant data must run inside a :class:`TenantContext`.
The context is stored in a :class:`~contextvars.ContextVar` so it flows across
async tasks and threads without threading it through every call signature. The API
layer sets it from the verified Supabase JWT; agent tool hooks read it to force
tenant scope on every downstream call.
"""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass, field

from aegis_core.errors import TenantContextError


@dataclass(frozen=True, slots=True)
class TenantContext:
    """Immutable tenant identity for the current execution scope."""

    tenant_id: str
    user_id: str | None = None
    role: str | None = None
    permissions: tuple[str, ...] = field(default_factory=tuple)

    def has_permission(self, permission: str) -> bool:
        """Return whether ``permission`` is granted to the active principal."""
        return permission in self.permissions


_tenant_ctx: ContextVar[TenantContext | None] = ContextVar("aegis_tenant_context", default=None)


def set_tenant_context(ctx: TenantContext) -> Token[TenantContext | None]:
    """Set the active tenant context, returning a token for :func:`reset_tenant_context`."""
    return _tenant_ctx.set(ctx)


def get_tenant_context() -> TenantContext | None:
    """Return the active tenant context, or ``None`` if none is set."""
    return _tenant_ctx.get()


def require_tenant_context() -> TenantContext:
    """Return the active tenant context or raise :class:`TenantContextError`."""
    ctx = _tenant_ctx.get()
    if ctx is None:
        raise TenantContextError("No tenant context is set for the current execution scope")
    return ctx


def current_tenant_id() -> str:
    """Return the active ``tenant_id`` or raise :class:`TenantContextError`."""
    return require_tenant_context().tenant_id


def reset_tenant_context(token: Token[TenantContext | None]) -> None:
    """Reset the tenant context to the value captured by ``token``."""
    _tenant_ctx.reset(token)


def clear_tenant_context() -> None:
    """Clear the tenant context for the current scope (sets it to ``None``)."""
    _tenant_ctx.set(None)
