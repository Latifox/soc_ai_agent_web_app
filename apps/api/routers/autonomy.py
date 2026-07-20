"""Autonomy-policy API — per tenant × action-class mode (auto | approve | deny).

Governs whether the Response agent may execute a destructive action directly, must seek
approval, or is denied outright. Kill-switch = set every class to ``deny``.
See docs/03-agents.md §6.2.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from aegis_core import TenantContext

from apps.api.deps import CurrentTenant
from apps.api.rbac import require_permission
from apps.api.schemas import AutonomyPolicyUpsert
from apps.api.store import autonomy_repo

router = APIRouter(prefix="/autonomy-policies", tags=["autonomy"])

PolicyAdmin = Annotated[TenantContext, Depends(require_permission("autonomy:write"))]


@router.get("")
async def list_policies(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List autonomy policies for the tenant."""
    return autonomy_repo.list(tenant.tenant_id)


@router.put("")
async def upsert_policy(body: AutonomyPolicyUpsert, tenant: PolicyAdmin) -> dict[str, Any]:
    """Set the mode for an action class (creates or updates)."""
    existing = next(
        (p for p in autonomy_repo.list(tenant.tenant_id) if p.get("action_class") == body.action_class),
        None,
    )
    if existing is not None:
        updated = autonomy_repo.update(tenant.tenant_id, existing["id"], {"mode": body.mode})
        assert updated is not None  # noqa: S101 - fetched above under lock
        return updated
    return autonomy_repo.create(tenant.tenant_id, body.model_dump())
