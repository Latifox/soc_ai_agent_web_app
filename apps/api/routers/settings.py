"""Settings API — editable per-tenant workspace configuration.

A single settings document per tenant (org profile, analyst preferences, detection
defaults, retention). Reads are open to the tenant; writes require an admin permission.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from aegis_core import TenantContext

from apps.api.deps import CurrentTenant
from apps.api.rbac import require_permission
from apps.api.schemas import SettingsUpdate
from apps.api.store import settings_store

router = APIRouter(prefix="/settings", tags=["settings"])

SettingsAdmin = Annotated[TenantContext, Depends(require_permission("autonomy:write"))]


@router.get("")
async def get_settings(tenant: CurrentTenant) -> dict[str, Any]:
    """Return the tenant's settings (defaults merged with any saved overrides)."""
    return settings_store.get(tenant.tenant_id)


@router.put("")
async def update_settings(body: SettingsUpdate, tenant: SettingsAdmin) -> dict[str, Any]:
    """Persist a partial settings update (only the fields sent change)."""
    return settings_store.update(tenant.tenant_id, body.to_patch())
