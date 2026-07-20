"""Rules API — detection-as-code CRUD + backtest.

Reads use the tenant context; writes require ``rules:write``. Backtest compiles the
rule's YAML and runs it over recent tenant events via the detection engine.
"""

from __future__ import annotations

from typing import Annotated, Any

import yaml
from fastapi import APIRouter, Depends

from aegis_core import TenantContext
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.schemas import BacktestRequest, RuleCreate, RuleUpdate
from apps.api.store import rules_repo

router = APIRouter(prefix="/rules", tags=["rules"])

RulesWriter = Annotated[TenantContext, Depends(require_permission("rules:write"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Rule not found"}}


@router.get("")
async def list_rules(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List the tenant's rules."""
    return rules_repo.list(tenant.tenant_id)


@router.post("", status_code=201)
async def create_rule(body: RuleCreate, tenant: RulesWriter) -> dict[str, Any]:
    """Create a rule (version 1)."""
    return rules_repo.create(tenant.tenant_id, {**body.model_dump(), "version": 1})


@router.get("/{rule_id}", responses=_NOT_FOUND)
async def get_rule(rule_id: str, tenant: CurrentTenant) -> dict[str, Any]:
    """Fetch one rule."""
    rule = rules_repo.get(tenant.tenant_id, rule_id)
    if rule is None:
        raise NotFoundError(f"rule {rule_id} not found")
    return rule


@router.put("/{rule_id}", responses=_NOT_FOUND)
async def update_rule(rule_id: str, body: RuleUpdate, tenant: RulesWriter) -> dict[str, Any]:
    """Update a rule and bump its version."""
    current = rules_repo.get(tenant.tenant_id, rule_id)
    if current is None:
        raise NotFoundError(f"rule {rule_id} not found")
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    patch["version"] = int(current.get("version", 1)) + 1
    updated = rules_repo.update(tenant.tenant_id, rule_id, patch)
    assert updated is not None  # noqa: S101 - just fetched above under lock
    return updated


@router.delete("/{rule_id}", status_code=204, responses=_NOT_FOUND)
async def delete_rule(rule_id: str, tenant: RulesWriter) -> None:
    """Delete a rule."""
    if not rules_repo.delete(tenant.tenant_id, rule_id):
        raise NotFoundError(f"rule {rule_id} not found")


@router.post("/{rule_id}/backtest", responses=_NOT_FOUND)
async def backtest_rule(rule_id: str, body: BacktestRequest, tenant: CurrentTenant) -> dict[str, Any]:
    """Backtest a rule over the last N days of the tenant's events."""
    rule = rules_repo.get(tenant.tenant_id, rule_id)
    if rule is None:
        raise NotFoundError(f"rule {rule_id} not found")
    from aegis_detection.run import backtest  # noqa: PLC0415 - keeps API import light

    data = yaml.safe_load(rule["yaml"])
    return backtest(data, days=body.days, tenant_id=tenant.tenant_id)
