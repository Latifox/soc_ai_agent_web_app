"""Reports API — generate executive / operational summaries from live tenant data.

Reports are composed from the metadata store (incidents, cases, rules, integrations) at
generation time and persisted, so a report is a point-in-time snapshot the analyst can
revisit. No canned content — every figure is computed from the tenant's records.
"""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from aegis_core import TenantContext
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.store import cases_repo, incidents_repo, integrations_repo, rules_repo

router = APIRouter(prefix="/reports", tags=["reports"])

ReportAuthor = Annotated[TenantContext, Depends(require_permission("cases:write"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Report not found"}}

ReportKind = Literal["executive", "incident", "detection"]


class ReportRequest(BaseModel):
    kind: ReportKind = "executive"
    window_days: int = 30


def _severity_rank(s: str) -> int:
    return {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}.get(s, 0)


def _compose(tenant_id: str, kind: str, window_days: int) -> dict[str, Any]:
    incidents = incidents_repo.list(tenant_id)
    rules = rules_repo.list(tenant_id)
    cases = cases_repo.list(tenant_id)
    integrations = integrations_repo.list(tenant_id)

    open_inc = [i for i in incidents if i.get("status") != "resolved"]
    resolved = [i for i in incidents if i.get("status") == "resolved"]
    by_sev = Counter(i.get("severity", "low") for i in incidents)
    mitre = sorted({t for r in rules for t in r.get("tags", []) if t.upper().startswith("T1")})
    top = sorted(incidents, key=lambda i: _severity_rank(i.get("severity", "low")), reverse=True)[:5]
    connected = sum(1 for i in integrations if i.get("status") == "connected")

    summary = (
        f"Over the reporting window, Aegis tracked {len(incidents)} incident(s) "
        f"({len(open_inc)} open, {len(resolved)} resolved) across {connected} connected "
        f"source(s). {by_sev.get('critical', 0)} critical and {by_sev.get('high', 0)} high-severity "
        f"detections were raised by {sum(1 for r in rules if r.get('enabled'))} enabled rule(s) "
        f"covering {len(mitre)} MITRE technique(s). {len(cases)} case(s) are under investigation."
    )
    sections = [
        {"heading": "Summary", "body": summary},
        {"heading": "Severity breakdown", "items": [f"{k}: {v}" for k, v in sorted(by_sev.items(), key=lambda kv: _severity_rank(kv[0]), reverse=True)]},
        {"heading": "Top incidents", "items": [f"{i.get('title')} — {i.get('severity')} ({i.get('status')})" for i in top]},
        {"heading": "MITRE ATT&CK coverage", "items": mitre or ["No techniques mapped."]},
        {"heading": "Data sources", "items": [f"{i.get('name')} — {i.get('status')}" for i in integrations]},
    ]
    return {
        "kind": kind,
        "title": f"{kind.title()} report — {datetime.now(UTC).strftime('%Y-%m-%d')}",
        "window_days": window_days,
        "generated_at": datetime.now(UTC).isoformat(),
        "metrics": {
            "incidents": len(incidents),
            "open": len(open_inc),
            "resolved": len(resolved),
            "critical": by_sev.get("critical", 0),
            "high": by_sev.get("high", 0),
            "cases": len(cases),
            "rules_enabled": sum(1 for r in rules if r.get("enabled")),
            "mitre": len(mitre),
        },
        "sections": sections,
    }


@router.get("")
async def list_reports(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List generated reports (newest first)."""
    from apps.api.store import reports_repo  # noqa: PLC0415

    return sorted(reports_repo.list(tenant.tenant_id), key=lambda r: r.get("generated_at", ""), reverse=True)


@router.post("/generate", status_code=201)
async def generate_report(body: ReportRequest, tenant: ReportAuthor) -> dict[str, Any]:
    """Compose a report from the tenant's live data and persist it."""
    from apps.api.store import reports_repo  # noqa: PLC0415

    report = _compose(tenant.tenant_id, body.kind, body.window_days)
    return reports_repo.create(tenant.tenant_id, report)


@router.get("/{report_id}", responses=_NOT_FOUND)
async def get_report(report_id: str, tenant: CurrentTenant) -> dict[str, Any]:
    """Fetch one report."""
    from apps.api.store import reports_repo  # noqa: PLC0415

    report = reports_repo.get(tenant.tenant_id, report_id)
    if report is None:
        raise NotFoundError(f"report {report_id} not found")
    return report
