"""FastAPI dependencies: Supabase JWT verification and tenant context.

``require_user`` verifies the bearer JWT (HS256 with ``SUPABASE_JWT_SECRET`` for
now — JWKS is a later hardening step) and ``require_tenant`` derives the
:class:`~aegis_core.TenantContext` from its claims. These are the stubs BE-03 will
extend with full RBAC / permission checks.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Annotated, Any

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from aegis_core import Settings, TenantContext, get_settings, set_tenant_context
from aegis_core.errors import AuthError

_bearer = HTTPBearer(auto_error=False)


def get_app_settings() -> Settings:
    """Dependency wrapper over :func:`aegis_core.get_settings` (override in tests)."""
    return get_settings()


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    """The verified principal for the current request."""

    user_id: str
    email: str | None = None
    claims: dict[str, Any] = field(default_factory=dict)


def require_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> AuthenticatedUser:
    """Verify the Supabase JWT and return the authenticated user."""
    if credentials is None or not credentials.credentials:
        raise AuthError("Missing bearer token")
    try:
        payload: dict[str, Any] = jwt.decode(
            credentials.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            # Supabase tokens carry aud="authenticated"; audience checking is
            # deferred to the JWKS hardening step (BE-03).
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise AuthError(f"Invalid token: {exc}") from exc

    sub = payload.get("sub")
    if not sub:
        raise AuthError("Token missing 'sub' claim")
    return AuthenticatedUser(user_id=str(sub), email=payload.get("email"), claims=payload)


def require_tenant(
    user: Annotated[AuthenticatedUser, Depends(require_user)],
) -> TenantContext:
    """Build and activate the :class:`TenantContext` from the JWT claims."""
    tenant_id = user.claims.get("tenant_id")
    if not tenant_id:
        raise AuthError("Token missing 'tenant_id' claim", http_status=403)
    permissions = tuple(user.claims.get("permissions") or ())
    ctx = TenantContext(
        tenant_id=str(tenant_id),
        user_id=user.user_id,
        role=user.claims.get("role"),
        permissions=permissions,
    )
    # BE-04 will move this into request middleware with proper reset; setting it in
    # the dependency makes the context available to the route handler today.
    set_tenant_context(ctx)
    return ctx


CurrentUser = Annotated[AuthenticatedUser, Depends(require_user)]
CurrentTenant = Annotated[TenantContext, Depends(require_tenant)]
