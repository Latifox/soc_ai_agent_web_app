"""Integrations API — connector hub CRUD + live connection test.

For first-party data connectors (``clickhouse``/``opensearch``) the ``/test`` endpoint runs
a *real* connectivity probe and, on success, registers the connector so the Argus crew's
tools query the tenant's own datastore (see :mod:`aegis_core.connectors`). CRUD keeps the
registry in sync so an ``agent_access`` toggle takes effect immediately.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from aegis_core import (
    DATA_PROVIDERS,
    TenantContext,
    connector_registry,
    ping_connector,
)
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.schemas import IntegrationCreate, IntegrationUpdate
from apps.api.store import integrations_repo

router = APIRouter(prefix="/integrations", tags=["integrations"])

IntegrationsAdmin = Annotated[TenantContext, Depends(require_permission("integrations:write"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Integration not found"}}


def _sync_registry(tenant_id: str, integration: dict[str, Any]) -> None:
    """Mirror a data connector's config/access grant into the crew connector registry."""
    provider = integration.get("provider")
    if provider not in DATA_PROVIDERS:
        return
    config = integration.get("config") or {}
    agent_access = bool(config.get("agent_access", True))
    connector_registry.set(tenant_id, provider, config, agent_access=agent_access)


@router.get("")
async def list_integrations(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List the tenant's integrations."""
    return integrations_repo.list(tenant.tenant_id)


@router.post("", status_code=201)
async def add_integration(body: IntegrationCreate, tenant: IntegrationsAdmin) -> dict[str, Any]:
    """Add an integration (starts disconnected)."""
    created = integrations_repo.create(
        tenant.tenant_id, {**body.model_dump(), "status": "disconnected", "health": {}}
    )
    _sync_registry(tenant.tenant_id, created)
    return created


@router.patch("/{integration_id}", responses=_NOT_FOUND)
async def update_integration(integration_id: str, body: IntegrationUpdate, tenant: IntegrationsAdmin) -> dict[str, Any]:
    """Update an integration (name, config, or agent-access grant)."""
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = integrations_repo.update(tenant.tenant_id, integration_id, patch)
    if updated is None:
        raise NotFoundError(f"integration {integration_id} not found")
    _sync_registry(tenant.tenant_id, updated)
    return updated


@router.post("/{integration_id}/test", responses=_NOT_FOUND)
async def test_integration(integration_id: str, tenant: IntegrationsAdmin) -> dict[str, Any]:
    """Run a live connectivity probe; mark connected/error and grant the crew access on success."""
    integration = integrations_repo.get(tenant.tenant_id, integration_id)
    if integration is None:
        raise NotFoundError(f"integration {integration_id} not found")
    provider = str(integration.get("provider", ""))
    config = integration.get("config") or {}
    health = ping_connector(provider, config)
    status = "connected" if health.get("ok") else "error"
    updated = integrations_repo.update(
        tenant.tenant_id, integration_id, {"status": status, "health": health}
    )
    assert updated is not None  # noqa: S101 - fetched above under lock
    if status == "connected":
        _sync_registry(tenant.tenant_id, updated)
    return updated


@router.delete("/{integration_id}", status_code=204, responses=_NOT_FOUND)
async def delete_integration(integration_id: str, tenant: IntegrationsAdmin) -> None:
    """Remove an integration and revoke any crew connector it registered."""
    existing = integrations_repo.get(tenant.tenant_id, integration_id)
    if not integrations_repo.delete(tenant.tenant_id, integration_id):
        raise NotFoundError(f"integration {integration_id} not found")
    if existing and existing.get("provider") in DATA_PROVIDERS:
        connector_registry.remove(tenant.tenant_id, str(existing["provider"]))
