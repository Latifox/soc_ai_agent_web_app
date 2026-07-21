"""Cases API — investigation containers with comments."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from aegis_core import TenantContext
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.schemas import CaseCreate, CaseUpdate, CommentCreate
from apps.api.store import cases_repo

router = APIRouter(prefix="/cases", tags=["cases"])

CasesWriter = Annotated[TenantContext, Depends(require_permission("cases:write"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Case not found"}}


@router.get("")
async def list_cases(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List the tenant's cases."""
    return cases_repo.list(tenant.tenant_id)


@router.post("", status_code=201)
async def create_case(body: CaseCreate, tenant: CasesWriter) -> dict[str, Any]:
    """Open a new case."""
    return cases_repo.create(
        tenant.tenant_id,
        {**body.model_dump(), "status": "open", "assignee": tenant.user_id, "comments": []},
    )


@router.get("/{case_id}", responses=_NOT_FOUND)
async def get_case(case_id: str, tenant: CurrentTenant) -> dict[str, Any]:
    """Fetch one case."""
    case = cases_repo.get(tenant.tenant_id, case_id)
    if case is None:
        raise NotFoundError(f"case {case_id} not found")
    return case


@router.patch("/{case_id}", responses=_NOT_FOUND)
async def update_case(case_id: str, body: CaseUpdate, tenant: CasesWriter) -> dict[str, Any]:
    """Update a case's status / assignee / title / description."""
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = cases_repo.update(tenant.tenant_id, case_id, patch)
    if updated is None:
        raise NotFoundError(f"case {case_id} not found")
    return updated


@router.post("/{case_id}/comments", status_code=201, responses=_NOT_FOUND)
async def add_comment(case_id: str, body: CommentCreate, tenant: CasesWriter) -> dict[str, Any]:
    """Append a comment to a case."""
    case = cases_repo.get(tenant.tenant_id, case_id)
    if case is None:
        raise NotFoundError(f"case {case_id} not found")
    comment = {
        "author": tenant.user_id,
        "body": body.body,
        "ts": datetime.now(UTC).isoformat(),
    }
    comments = [*case.get("comments", []), comment]
    updated = cases_repo.update(tenant.tenant_id, case_id, {"comments": comments})
    assert updated is not None  # noqa: S101 - just fetched above under lock
    return updated
