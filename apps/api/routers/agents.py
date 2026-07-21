"""Agents API — live status of the Argus crew for the tenant.

Roster comes from the agents package (single source of truth); per-agent state is
derived from the tenant's live data: pending approvals pause the Response agent,
open/in-progress incidents drive Triage/Investigation activity.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from apps.api.deps import CurrentTenant
from apps.api.store import approvals_repo, incidents_repo, rules_repo

router = APIRouter(prefix="/agents", tags=["agents"])

_FALLBACK_CREW = [
    {"key": "triage", "name": "Triage", "role": "Deduplicate, correlate and score incidents", "tier": "fast"},
    {"key": "investigation", "name": "Investigation", "role": "Build MITRE-mapped attack narratives", "tier": "reasoner"},
    {"key": "threat_intel", "name": "Threat Intel", "role": "IOC reputation and context", "tier": "fast"},
    {"key": "response", "name": "Response", "role": "Execute SOAR playbooks under approval policy", "tier": "balanced"},
    {"key": "detection_eng", "name": "Detection Engineering", "role": "Generate and tune detection rules", "tier": "reasoner"},
    {"key": "reporting", "name": "Reporting", "role": "Case reports and executive summaries", "tier": "balanced"},
]


def _crew() -> list[dict[str, str]]:
    try:
        from aegis_agents.roster import CREW  # noqa: PLC0415

        return CREW
    except ImportError:
        return _FALLBACK_CREW


@router.get("/status")
async def agents_status(tenant: CurrentTenant) -> dict[str, Any]:
    """Crew roster + live per-agent state derived from the tenant's workload."""
    tid = tenant.tenant_id
    incidents = incidents_repo.list(tid)
    approvals = [a for a in approvals_repo.list(tid) if a.get("status") == "pending"]
    open_incidents = [i for i in incidents if i.get("status") == "open"]
    investigating = [i for i in incidents if i.get("status") == "in_progress"]
    enabled_rules = sum(1 for r in rules_repo.list(tid) if r.get("enabled"))

    def state_for(key: str) -> dict[str, str]:
        if key == "triage":
            n = len(open_incidents)
            return {"state": "running" if n else "idle", "task": f"Correlating {n} open incidents" if n else "Queue clear"}
        if key == "investigation":
            if investigating:
                return {"state": "running", "task": f"Investigating: {investigating[0].get('title', '')[:60]}"}
            return {"state": "idle", "task": "No active investigation"}
        if key == "threat_intel":
            entities = {e for i in investigating + open_incidents for e in i.get("entities", [])}
            return {"state": "running" if entities else "idle", "task": f"Enriching {len(entities)} entities" if entities else "No indicators queued"}
        if key == "response":
            if approvals:
                return {"state": "paused", "task": f"Awaiting approval: {approvals[0].get('tool_name', '')}"}
            return {"state": "idle", "task": "No response actions pending"}
        if key == "detection_eng":
            return {"state": "idle", "task": f"Monitoring {enabled_rules} enabled rules"}
        return {"state": "idle", "task": "Standing by for case updates"}

    return {
        "operational": True,
        "pending_approvals": len(approvals),
        "agents": [{**member, **state_for(member["key"])} for member in _crew()],
    }
