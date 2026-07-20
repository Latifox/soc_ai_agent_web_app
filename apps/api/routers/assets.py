"""Assets API — inventory of hosts/users/cloud/identity entities."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from aegis_core import TenantContext
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.schemas import AssetCreate
from apps.api.store import assets_repo

router = APIRouter(prefix="/assets", tags=["assets"])

AssetsWriter = Annotated[TenantContext, Depends(require_permission("assets:write"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Asset not found"}}


@router.get("")
async def list_assets(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List the tenant's assets."""
    return assets_repo.list(tenant.tenant_id)


@router.post("", status_code=201)
async def create_asset(body: AssetCreate, tenant: AssetsWriter) -> dict[str, Any]:
    """Upsert an asset into inventory."""
    return assets_repo.create(tenant.tenant_id, {**body.model_dump(), "risk_score": 0})


@router.get("/{asset_id}", responses=_NOT_FOUND)
async def get_asset(asset_id: str, tenant: CurrentTenant) -> dict[str, Any]:
    """Fetch one asset."""
    asset = assets_repo.get(tenant.tenant_id, asset_id)
    if asset is None:
        raise NotFoundError(f"asset {asset_id} not found")
    return asset
