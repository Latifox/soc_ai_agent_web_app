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

from apps.api.deps import CurrentTenant, get_app_settings
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


def _mint_token(tenant_id: str, name: str, secret: str) -> str:
    claims = {
        "sub": f"onboard-{tenant_id[:8]}",
        "email": f"admin@{name.lower().replace(' ', '-')}.aegis",
        "tenant_id": tenant_id,
        "role": "admin",
        "permissions": _DEFAULT_PERMISSIONS,
        "aud": "authenticated",
        "exp": int(time.time()) + 60 * 60 * 24 * 7,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


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


@router.post("/test-source")
async def test_source(body: SourceTestRequest, _: TenantAdmin) -> dict[str, Any]:
    """Probe an external OpenSearch source without persisting anything (wizard step)."""
    return ping_connector("opensearch", body.opensearch.model_dump())


@router.post("", status_code=201)
async def create_tenant(body: TenantCreate, _: TenantAdmin, settings=Depends(get_app_settings)) -> dict[str, Any]:
    """Onboard a tenant: create it, verify + store its OpenSearch source, grant crew access."""
    cfg = {**body.opensearch.model_dump(), "agent_access": True}
    health = ping_connector("opensearch", body.opensearch.model_dump())
    # Use the caller-supplied id (to match their log pipeline) or generate one.
    tenant_id = (body.tenant_id or "").strip() or str(uuid.uuid4())

    tenant = tenants_store.create(tenant_id, body.name, body.opensearch.url)
    # Store the source as an integration under the NEW tenant so its crew can query it.
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

    token = _mint_token(tenant_id, body.name, settings.supabase_jwt_secret)
    log.info("tenant.onboarded", tenant_id=tenant_id, name=body.name, source_ok=health.get("ok"))
    return {"tenant": tenant, "source_health": health, "token": token}
