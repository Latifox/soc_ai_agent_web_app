"""Rules API — detection-as-code CRUD + backtest.

Reads use the tenant context; writes require ``rules:write``. Backtest compiles the
rule's YAML and runs it over recent tenant events via the detection engine.
"""

from __future__ import annotations

from typing import Annotated, Any

import yaml
from fastapi import APIRouter, Depends

from datetime import datetime, timezone

from aegis_core import TenantContext, get_logger, get_settings, opensearch_for_tenant
from aegis_core.errors import NotFoundError, PermissionDeniedError

log = get_logger(__name__)

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.schemas import BacktestRequest, RuleApplyRequest, RuleCreate, RuleUpdate
from apps.api.store import incidents_repo, integrations_repo, rules_repo

router = APIRouter(prefix="/rules", tags=["rules"])

RulesWriter = Annotated[TenantContext, Depends(require_permission("rules:write"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Rule not found"}}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("")
async def list_rules(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List the tenant's rules."""
    return rules_repo.list(tenant.tenant_id)


@router.get("/monitors")
async def list_monitors(tenant: CurrentTenant) -> dict[str, Any]:
    """List the OpenSearch Alerting monitors deployed on the tenant's cluster.

    Declared before ``/{rule_id}`` so the literal path wins over the id matcher.
    """
    client = opensearch_for_tenant(tenant.tenant_id, get_settings())
    try:
        monitors = client.list_monitors()
        return {"available": True, "monitors": monitors}
    except Exception as exc:  # noqa: BLE001 - unreachable/alerting-disabled is a real state
        log.info("rule.monitors.unavailable", tenant_id=tenant.tenant_id, error=str(exc)[:160])
        return {"available": False, "monitors": [], "reason": "OpenSearch alerting unavailable"}


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


@router.get("/monitors/{monitor_id}")
async def get_monitor(monitor_id: str, tenant: CurrentTenant) -> dict[str, Any]:
    """Fetch one deployed OpenSearch monitor (full definition)."""
    client = opensearch_for_tenant(tenant.tenant_id, get_settings())
    monitor = client.get_monitor(monitor_id)
    if monitor is None:
        raise NotFoundError(f"monitor {monitor_id} not found")
    return monitor


@router.post("/monitors/{monitor_id}/toggle")
async def toggle_monitor(monitor_id: str, tenant: RulesWriter) -> dict[str, Any]:
    """Enable/disable a deployed monitor on the tenant's OpenSearch cluster."""
    client = opensearch_for_tenant(tenant.tenant_id, get_settings())
    current = client.get_monitor(monitor_id)
    if current is None:
        raise NotFoundError(f"monitor {monitor_id} not found")
    monitor = current.get("monitor", current)
    monitor["enabled"] = not bool(monitor.get("enabled", True))
    client.update_monitor(monitor_id, monitor)
    return {"id": monitor_id, "enabled": monitor["enabled"]}


@router.delete("/monitors/{monitor_id}", status_code=204)
async def delete_monitor(monitor_id: str, tenant: RulesWriter) -> None:
    """Delete a deployed monitor from the tenant's OpenSearch cluster."""
    client = opensearch_for_tenant(tenant.tenant_id, get_settings())
    if not client.delete_monitor(monitor_id):
        raise NotFoundError(f"monitor {monitor_id} not found")
    # Detach it from any Aegis rule that owns it.
    for r in rules_repo.list(tenant.tenant_id):
        if r.get("monitor_id") == monitor_id:
            rules_repo.update(tenant.tenant_id, r["id"], {"monitor_id": None})


@router.post("/monitors/{monitor_id}/import", status_code=201)
async def import_monitor(monitor_id: str, tenant: RulesWriter) -> dict[str, Any]:
    """Import an existing OpenSearch monitor into Aegis as a managed rule."""
    client = opensearch_for_tenant(tenant.tenant_id, get_settings())
    fetched = client.get_monitor(monitor_id)
    if fetched is None:
        raise NotFoundError(f"monitor {monitor_id} not found")
    m = fetched.get("monitor", fetched)
    # Pull the Lucene/query_string out of the monitor's search input when present.
    query = "*"
    try:
        filters = m["inputs"][0]["search"]["query"]["query"]["bool"]["filter"]
        qs = next((f["query_string"]["query"] for f in filters if "query_string" in f), None)
        query = qs or query
    except Exception:  # noqa: BLE001 - best-effort extraction
        pass
    period = (m.get("schedule", {}).get("period") or {})
    freq = f"{period.get('interval', 5)}{str(period.get('unit', 'MINUTES'))[0].lower()}"
    title = m.get("name", "Imported monitor")
    yaml_text = f"title: {title}\nseverity: medium\ntype: query\nenabled: {bool(m.get('enabled', True))}\nfrequency: {freq}\ndepth: 15m\ntags: [imported, opensearch]\nquery: {query}\n"
    created = rules_repo.create(
        tenant.tenant_id,
        {"title": title, "severity": "medium", "type": "query", "enabled": bool(m.get("enabled", True)),
         "yaml": yaml_text, "tags": ["imported", "opensearch"], "integration": "opensearch",
         "monitor_id": monitor_id, "author": "imported"},
    )
    return created


@router.post("/{rule_id}/apply", responses=_NOT_FOUND)
async def apply_rule(rule_id: str, body: RuleApplyRequest, tenant: RulesWriter) -> dict[str, Any]:
    """Deploy a rule to a connected integration: bind it, enable it, bump version.

    The target must be an integration the tenant has configured; deploying to a
    disconnected connector is rejected so a rule never claims to be live when its
    source isn't.
    """
    rule = rules_repo.get(tenant.tenant_id, rule_id)
    if rule is None:
        raise NotFoundError(f"rule {rule_id} not found")
    integration = next(
        (i for i in integrations_repo.list(tenant.tenant_id) if i.get("provider") == body.integration),
        None,
    )
    if integration is None:
        raise NotFoundError(f"no '{body.integration}' integration configured for this tenant")
    if integration.get("status") == "disconnected":
        raise PermissionDeniedError(f"integration '{body.integration}' is not connected — test it first")

    # Really deploy: compile the rule into an OpenSearch Alerting monitor and create/update
    # it on the tenant's cluster (visible in OpenSearch Dashboards → Alerting → Monitors).
    deployment: dict[str, Any] = {"target": body.integration, "pushed": False}
    monitor_id = rule.get("monitor_id")
    if body.provider_is_opensearch():
        import yaml as _yaml  # noqa: PLC0415
        from aegis_detection.monitor import rule_to_monitor  # noqa: PLC0415

        client = opensearch_for_tenant(tenant.tenant_id, get_settings())
        try:
            data = _yaml.safe_load(rule["yaml"]) or {}
            data["enabled"] = True
            monitor = rule_to_monitor(data, tenant_id=tenant.tenant_id)
            if monitor_id:
                resp = client.update_monitor(str(monitor_id), monitor)
            else:
                resp = client.create_monitor(monitor)
                monitor_id = resp.get("_id")
            deployment = {"target": "opensearch", "pushed": True, "monitor_id": monitor_id, "name": monitor["name"], "result": "updated" if rule.get("monitor_id") else "created"}
        except Exception as exc:  # noqa: BLE001 - surface a real failure to the caller
            log.error("rule.deploy.monitor.failed", tenant_id=tenant.tenant_id, error=str(exc)[:200])
            raise PermissionDeniedError(f"deploy monitor to OpenSearch failed: {str(exc)[:160]}") from exc

    patch = {
        "integration": body.integration,
        "enabled": True,
        "version": int(rule.get("version", 1)) + 1,
        "applied_at": _now_iso(),
        "monitor_id": monitor_id,
        "deployment": deployment,
    }
    updated = rules_repo.update(tenant.tenant_id, rule_id, patch)
    assert updated is not None  # noqa: S101 - fetched above under lock
    return updated


@router.post("/{rule_id}/run", responses=_NOT_FOUND)
async def run_rule_now(rule_id: str, tenant: RulesWriter) -> dict[str, Any]:
    """Evaluate a rule against live events and raise correlated incidents on matches.

    This is the detection→incident bridge: run the rule over the tenant's OpenSearch
    events, correlate the matches by (rule, primary entity), and create/refresh an incident
    in the metadata store for each cluster. Re-running is idempotent — an existing incident
    for the same correlation key is updated, not duplicated.
    """
    rule = rules_repo.get(tenant.tenant_id, rule_id)
    if rule is None:
        raise NotFoundError(f"rule {rule_id} not found")
    from aegis_detection.correlate import correlate, correlation_key
    from aegis_detection.run import run_rule

    data = yaml.safe_load(rule["yaml"]) or {}
    data.setdefault("rule_id", rule_id)
    try:
        result = run_rule(data, tenant_id=tenant.tenant_id)
    except Exception as exc:  # noqa: BLE001 - a bad rule/query is a 400, not a 500
        raise PermissionDeniedError(f"rule failed to run: {str(exc)[:200]}") from exc

    # Threshold rules yield breaches (entity + metric); query rules yield event hits.
    severity = str(rule.get("severity", "medium"))
    detections: list[dict[str, Any]] = []
    if result["breaches"]:
        for b in result["breaches"]:
            detections.append({"rule_id": rule_id, "severity": severity, "entities": b["entities"], "metric": b.get("metric")})
    elif result["matches"]:
        entities = sorted({
            str(h.get("host", {}).get("name") or h.get("source", {}).get("ip") or h.get("user", {}).get("name") or "")
            for h in result["sample"]
        } - {""})
        detections.append({"rule_id": rule_id, "severity": severity, "entities": entities or ["match"], "metric": result["matches"]})

    if not detections:
        return {"matches": 0, "incidents_created": [], "incidents_updated": [], "note": "no events matched the rule"}

    existing = {i.get("correlation_key"): i for i in incidents_repo.list(tenant.tenant_id) if i.get("correlation_key")}
    created: list[str] = []
    updated_ids: list[str] = []
    for candidate in correlate(detections):
        key = candidate["correlation_key"]
        metric = next((d.get("metric") for d in detections if correlation_key(d) == key), None)
        prior = existing.get(key)
        if prior is not None:
            incidents_repo.update(tenant.tenant_id, prior["id"], {"detection_count": candidate["detection_count"]})
            updated_ids.append(prior["id"])
            continue
        incident = incidents_repo.create(
            tenant.tenant_id,
            {
                "title": rule.get("title", "Detection"),
                "severity": candidate["severity"],
                "status": "open",
                "assignee": None,
                "tags": rule.get("tags", []),
                "description": f"Rule '{rule.get('title')}' matched {metric or candidate['detection_count']} event(s) for {', '.join(candidate['entities'][:4])}.",
                "detected_at": _now_iso(),
                "rule_title": rule.get("title"),
                "rule_id": rule_id,
                "entities": candidate["entities"],
                "correlation_key": key,
                "source": rule.get("integration"),
            },
        )
        created.append(incident["id"])
    return {"matches": result["matches"], "incidents_created": created, "incidents_updated": updated_ids}


@router.post("/{rule_id}/backtest", responses=_NOT_FOUND)
async def backtest_rule(rule_id: str, body: BacktestRequest, tenant: CurrentTenant) -> dict[str, Any]:
    """Backtest a rule over the last N days of the tenant's events."""
    rule = rules_repo.get(tenant.tenant_id, rule_id)
    if rule is None:
        raise NotFoundError(f"rule {rule_id} not found")
    from aegis_detection.run import backtest  # noqa: PLC0415 - keeps API import light

    data = yaml.safe_load(rule["yaml"])
    return backtest(data, days=body.days, tenant_id=tenant.tenant_id)
