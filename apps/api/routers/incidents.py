"""Incidents API — read + status/assignment updates."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from aegis_core import TenantContext
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.schemas import IncidentUpdate
from apps.api.store import incidents_repo

router = APIRouter(prefix="/incidents", tags=["incidents"])

IncidentsWriter = Annotated[TenantContext, Depends(require_permission("incidents:write"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Incident not found"}}


@router.get("")
async def list_incidents(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List the tenant's incidents."""
    return incidents_repo.list(tenant.tenant_id)


@router.get("/{incident_id}", responses=_NOT_FOUND)
async def get_incident(incident_id: str, tenant: CurrentTenant) -> dict[str, Any]:
    """Fetch one incident."""
    incident = incidents_repo.get(tenant.tenant_id, incident_id)
    if incident is None:
        raise NotFoundError(f"incident {incident_id} not found")
    return incident


@router.patch("/{incident_id}", responses=_NOT_FOUND)
async def update_incident(incident_id: str, body: IncidentUpdate, tenant: IncidentsWriter) -> dict[str, Any]:
    """Update an incident's status/assignee/severity."""
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = incidents_repo.update(tenant.tenant_id, incident_id, patch)
    if updated is None:
        raise NotFoundError(f"incident {incident_id} not found")
    return updated
