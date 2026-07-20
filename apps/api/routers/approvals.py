"""Approvals API — the HITL gate for destructive agent actions (AI-04).

When an agent run pauses on a ``requires_confirmation`` tool, an approval is recorded.
An authorized user approves/denies here; the decision resumes the paused AgentOS run
(``continue_run``). See docs/03-agents.md §6.2.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from aegis_core import TenantContext, get_logger
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.schemas import ApprovalDecision
from apps.api.store import approvals_repo

log = get_logger(__name__)
router = APIRouter(prefix="/approvals", tags=["approvals"])

Approver = Annotated[TenantContext, Depends(require_permission("soar:approve"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Approval not found"}}


@router.get("")
async def list_approvals(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List approvals (pending first are most relevant)."""
    return approvals_repo.list(tenant.tenant_id)


@router.get("/{approval_id}", responses=_NOT_FOUND)
async def get_approval(approval_id: str, tenant: CurrentTenant) -> dict[str, Any]:
    """Fetch one approval."""
    approval = approvals_repo.get(tenant.tenant_id, approval_id)
    if approval is None:
        raise NotFoundError(f"approval {approval_id} not found")
    return approval


@router.post("/{approval_id}", responses=_NOT_FOUND)
async def decide_approval(approval_id: str, body: ApprovalDecision, tenant: Approver) -> dict[str, Any]:
    """Approve or deny a pending action and resume the paused agent run."""
    approval = approvals_repo.get(tenant.tenant_id, approval_id)
    if approval is None:
        raise NotFoundError(f"approval {approval_id} not found")
    status = "approved" if body.decision == "approve" else "denied"
    updated = approvals_repo.update(
        tenant.tenant_id,
        approval_id,
        {"status": status, "decided_by": tenant.user_id, "decided_at": datetime.now(UTC).isoformat()},
    )
    assert updated is not None  # noqa: S101 - fetched above under lock
    # Resume the paused AgentOS run with the confirmed/rejected requirement. Wiring to the
    # AgentOS approvals endpoint (continue_run) lands with AI-05; recorded + audited here.
    log.info(
        "approval.decided",
        tenant_id=tenant.tenant_id,
        run_id=approval.get("run_id"),
        tool=approval.get("tool_name"),
        decision=body.decision,
    )
    return updated
