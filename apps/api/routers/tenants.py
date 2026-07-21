"""Tenants API — onboard a new workspace with its external OpenSearch source.

Onboarding creates a tenant in Supabase, tests + stores its OpenSearch connection (as an
``integration`` record under the new tenant so the Argus crew can query its logs), registers
the connector for agent access, provisions the tenant's events index template, and mints a
dev access token so the operator can switch into the new workspace immediately.
"""

from __future__ import annotations

import time
import uuid
from typing import Annotated, Any

import jwt
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from aegis_core import TenantContext, connector_registry, get_logger, get_settings, ping_connector
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant, CurrentUser, get_app_settings
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.store import integrations_repo, tenants_store

log = get_logger(__name__)
router = APIRouter(prefix="/tenants", tags=["tenants"])

TenantAdmin = Annotated[TenantContext, Depends(require_permission("autonomy:write"))]

_DEFAULT_PERMISSIONS = [
    "rules:read", "rules:write", "incidents:write", "cases:write",
    "assets:write", "integrations:write", "soar:approve", "autonomy:write",
]


class OpenSearchSource(BaseModel):
    url: str
    user: str = "admin"
    password: str = "admin"


class TenantCreate(BaseModel):
    name: str
    opensearch: OpenSearchSource
    # Optional: set the tenant id to match your log pipeline's LOGSTASH_TENANT_ID so the crew
    # queries the right ``t-{tenant_id}-*`` indices. Defaults to a generated uuid.
    tenant_id: str | None = None


class SourceTestRequest(BaseModel):
    opensearch: OpenSearchSource


class TenantUpdate(BaseModel):
    name: str | None = None


def _mint_token(tenant_id: str, name: str, secret: str, *, sub: str | None = None, email: str | None = None) -> str:
    claims = {
        "sub": sub or f"onboard-{tenant_id[:8]}",
        "email": email or f"admin@{name.lower().replace(' ', '-')}.aegis",
        "tenant_id": tenant_id,
        "role": "admin",
        "permissions": _DEFAULT_PERMISSIONS,
        "aud": "authenticated",
        "exp": int(time.time()) + 60 * 60 * 24 * 7,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def _provision_tenant(body: "TenantCreate", secret: str, *, sub: str | None = None, email: str | None = None) -> dict[str, Any]:
    """Create a tenant, store + register its OpenSearch source, mint an access token.

    Shared by admin onboarding (``POST /tenants``) and first-run bootstrap
    (``POST /tenants/bootstrap``). The minted token carries the new ``tenant_id`` + admin
    permissions so the caller can switch straight into the workspace.
    """
    cfg = {**body.opensearch.model_dump(), "agent_access": True}
    health = ping_connector("opensearch", body.opensearch.model_dump())
    tenant_id = (body.tenant_id or "").strip() or str(uuid.uuid4())

    tenant = tenants_store.create(tenant_id, body.name, body.opensearch.url)
    integrations_repo.create(
        tenant_id,
        {
            "provider": "opensearch",
            "name": f"{body.name} OpenSearch",
            "status": "connected" if health.get("ok") else "error",
            "health": health,
            "config": cfg,
        },
    )
    connector_registry.set(tenant_id, "opensearch", cfg, agent_access=True)
    if health.get("ok"):
        _provision_events_template(body.opensearch.model_dump(), tenant_id)

    token = _mint_token(tenant_id, body.name, secret, sub=sub, email=email)
    log.info("tenant.provisioned", tenant_id=tenant_id, name=body.name, source_ok=health.get("ok"), sub=sub)
    return {"tenant": tenant, "source_health": health, "token": token}


def _provision_events_template(cfg: dict[str, Any], tenant_id: str) -> None:
    """Best-effort: create the events index template on the tenant's cluster."""
    try:
        import httpx  # noqa: PLC0415

        from apps.api.dev_seed import _EVENTS_TEMPLATE  # noqa: PLC0415

        with httpx.Client(timeout=8.0, verify=False) as c:  # noqa: S501 - dev certs
            c.put(f"{cfg['url'].rstrip('/')}/_index_template/aegis-events", json=_EVENTS_TEMPLATE, auth=(cfg["user"], cfg["password"]))
    except Exception as exc:  # noqa: BLE001 - non-fatal
        log.info("tenant.template.skip", tenant_id=tenant_id, error=str(exc)[:120])


@router.get("")
async def list_tenants(_: CurrentTenant) -> list[dict[str, Any]]:
    """List onboarded tenants (the workspace directory)."""
    return tenants_store.list()


@router.patch("/{tenant_id}", responses={404: {"model": Problem, "description": "Tenant not found"}})
async def update_tenant(tenant_id: str, body: TenantUpdate, tenant: TenantAdmin) -> dict[str, Any]:
    """Rename a workspace. Admins may only edit their own tenant."""
    if tenant_id != tenant.tenant_id:
        raise NotFoundError(f"tenant {tenant_id} not found")
    updated = tenants_store.update(tenant_id, {"name": (body.name or "").strip() or None})
    if updated is None:
        raise NotFoundError(f"tenant {tenant_id} not found")
    log.info("tenant.updated", tenant_id=tenant_id, name=updated.get("name"))
    return updated


@router.post("/test-source")
async def test_source(body: SourceTestRequest, _: CurrentUser) -> dict[str, Any]:
    """Probe an external OpenSearch source without persisting anything (wizard step).

    Open to any authenticated user (including first-run users with no tenant yet) — it only
    pings the cluster and stores nothing.
    """
    return ping_connector("opensearch", body.opensearch.model_dump())


@router.post("", status_code=201)
async def create_tenant(body: TenantCreate, _: TenantAdmin, settings=Depends(get_app_settings)) -> dict[str, Any]:
    """Onboard an additional tenant (requires an existing admin)."""
    return _provision_tenant(body, settings.supabase_jwt_secret)


@router.post("/bootstrap", status_code=201)
async def bootstrap_tenant(body: TenantCreate, user: CurrentUser, settings=Depends(get_app_settings)) -> dict[str, Any]:
    """First-run onboarding: an authenticated user with no tenant yet creates their workspace.

    A freshly signed-up Supabase user has no ``tenant_id`` claim, so they cannot use the
    admin ``POST /tenants``. This creates their first tenant and mints a tenant-scoped admin
    token (carrying their own ``sub``/``email``) that the web stores as ``aegis_token`` to
    switch straight in.
    """
    return _provision_tenant(body, settings.supabase_jwt_secret, sub=user.user_id, email=user.email)
