"""Integrations API — connector hub CRUD + connection test."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from aegis_core import TenantContext
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.schemas import IntegrationCreate, IntegrationUpdate
from apps.api.store import integrations_repo

router = APIRouter(prefix="/integrations", tags=["integrations"])

IntegrationsAdmin = Annotated[TenantContext, Depends(require_permission("integrations:write"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Integration not found"}}


@router.get("")
async def list_integrations(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List the tenant's integrations."""
    return integrations_repo.list(tenant.tenant_id)


@router.post("", status_code=201)
async def add_integration(body: IntegrationCreate, tenant: IntegrationsAdmin) -> dict[str, Any]:
    """Add an integration (starts disconnected)."""
    return integrations_repo.create(
        tenant.tenant_id, {**body.model_dump(), "status": "disconnected", "health": {}}
    )


@router.patch("/{integration_id}", responses=_NOT_FOUND)
async def update_integration(integration_id: str, body: IntegrationUpdate, tenant: IntegrationsAdmin) -> dict[str, Any]:
    """Update an integration."""
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = integrations_repo.update(tenant.tenant_id, integration_id, patch)
    if updated is None:
        raise NotFoundError(f"integration {integration_id} not found")
    return updated


@router.post("/{integration_id}/test", responses=_NOT_FOUND)
async def test_integration(integration_id: str, tenant: IntegrationsAdmin) -> dict[str, Any]:
    """Test a connection; marks it connected on success (stub validates config presence)."""
    integration = integrations_repo.get(tenant.tenant_id, integration_id)
    if integration is None:
        raise NotFoundError(f"integration {integration_id} not found")
    status = "connected" if integration.get("config") else "error"
    updated = integrations_repo.update(tenant.tenant_id, integration_id, {"status": status})
    assert updated is not None  # noqa: S101 - fetched above under lock
    return updated


@router.delete("/{integration_id}", status_code=204, responses=_NOT_FOUND)
async def delete_integration(integration_id: str, tenant: IntegrationsAdmin) -> None:
    """Remove an integration."""
    if not integrations_repo.delete(tenant.tenant_id, integration_id):
        raise NotFoundError(f"integration {integration_id} not found")
