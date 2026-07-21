"""Metrics API — operational aggregates computed from the tenant's live data."""

from __future__ import annotations

from collections import Counter
from typing import Any

from fastapi import APIRouter

from apps.api.deps import CurrentTenant
from apps.api.store import (
    approvals_repo,
    assets_repo,
    cases_repo,
    incidents_repo,
    integrations_repo,
    rules_repo,
)

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("")
async def get_metrics(tenant: CurrentTenant) -> dict[str, Any]:
    """Aggregate dashboard metrics for the tenant (computed, not canned)."""
    tid = tenant.tenant_id
    incidents = incidents_repo.list(tid)
    rules = rules_repo.list(tid)
    cases = cases_repo.list(tid)
    integrations = integrations_repo.list(tid)
    approvals = approvals_repo.list(tid)
    assets = assets_repo.list(tid)

    open_incidents = [i for i in incidents if i.get("status") != "resolved"]
    severity_counts = Counter(i.get("severity", "low") for i in open_incidents)
    status_counts = Counter(i.get("status", "open") for i in incidents)
    mitre = sorted({t for r in rules for t in r.get("tags", []) if t.upper().startswith("T1")})

    return {
        "incidents": {
            "total": len(incidents),
            "open": len(open_incidents),
            "by_severity": dict(severity_counts),
            "by_status": dict(status_counts),
        },
        "rules": {
            "total": len(rules),
            "enabled": sum(1 for r in rules if r.get("enabled")),
            "mitre_techniques": mitre,
        },
        "cases": {
            "total": len(cases),
            "open": sum(1 for c in cases if c.get("status") != "closed"),
        },
        "integrations": {
            "total": len(integrations),
            "connected": sum(1 for i in integrations if i.get("status") == "connected"),
            "issues": sum(1 for i in integrations if i.get("status") == "error"),
        },
        "approvals": {"pending": sum(1 for a in approvals if a.get("status") == "pending")},
        "assets": {
            "total": len(assets),
            "high_risk": sum(1 for a in assets if int(a.get("risk_score", 0)) >= 70),
        },
    }
