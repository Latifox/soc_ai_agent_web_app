"""``/api/v1`` router (stub).

Feature routers (rules, incidents, cases, assets, integrations, …) mount here as
their backend tasks land. For now it exposes an unauthenticated root and a
tenant-protected ``/whoami`` that exercises the auth + tenant-context path.
"""

from __future__ import annotations

from fastapi import APIRouter

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.routers import (
    agents,
    approvals,
    assets,
    assistant,
    autonomy,
    cases,
    incidents,
    integrations,
    metrics,
    reports,
    rules,
    search,
    settings,
    telemetry,
)

router = APIRouter(tags=["v1"])

router.include_router(rules.router)
router.include_router(incidents.router)
router.include_router(cases.router)
router.include_router(assets.router)
router.include_router(integrations.router)
router.include_router(approvals.router)
router.include_router(autonomy.router)
router.include_router(search.router)
router.include_router(telemetry.router)
router.include_router(metrics.router)
router.include_router(reports.router)
router.include_router(settings.router)
router.include_router(assistant.router)
router.include_router(agents.router)


@router.get("/")
async def v1_root() -> dict[str, str]:
    """API v1 root — liveness of the versioned surface."""
    return {"service": "aegis-api", "version": "v1"}


@router.get(
    "/whoami",
    responses={
        401: {"model": Problem, "description": "Missing or invalid credentials"},
        403: {"model": Problem, "description": "No tenant claim"},
    },
)
async def whoami(tenant: CurrentTenant) -> dict[str, object]:
    """Echo the resolved tenant context (protected route)."""
    return {
        "tenant_id": tenant.tenant_id,
        "user_id": tenant.user_id,
        "role": tenant.role,
        "permissions": list(tenant.permissions),
    }
