"""Detection-rule tools for the Detection-Engineering agent (Vibe Detection).

``rule_validate`` checks a rule's YAML against the Aegis schema; ``rule_backtest``
compiles it and runs it over recent tenant events. Backtest delegates to the
detection engine (``aegis_detection``) when available, else reports that the engine
is not wired yet — keeping the crew import-safe.
"""

from __future__ import annotations

from typing import Any

import yaml
from agno.tools import tool

from aegis_core import current_tenant_id, get_logger

log = get_logger(__name__)

_REQUIRED = ("title", "severity", "type")
_TYPES = {"query", "advanced_threshold", "source_monitor", "threat_match", "code", "spark"}


@tool(name="rule_validate", show_result=True)
def rule_validate(rule_yaml: str) -> dict[str, Any]:
    """Validate a detection rule's YAML against the Aegis schema.

    Returns ``{valid, errors, rule_id, type}``. Use before proposing a rule to the user.
    """
    try:
        data = yaml.safe_load(rule_yaml)
    except yaml.YAMLError as exc:
        return {"valid": False, "errors": [f"invalid YAML: {exc}"]}
    if not isinstance(data, dict):
        return {"valid": False, "errors": ["rule must be a YAML mapping"]}
    errors = [f"missing required field: {k}" for k in _REQUIRED if k not in data]
    if data.get("type") and data["type"] not in _TYPES:
        errors.append(f"unknown type: {data['type']!r} (expected one of {sorted(_TYPES)})")
    return {
        "valid": not errors,
        "errors": errors,
        "rule_id": data.get("rule_id"),
        "type": data.get("type"),
    }


@tool(name="rule_backtest", show_result=True)
def rule_backtest(rule_yaml: str, days: int = 30) -> dict[str, Any]:
    """Compile a rule and run it over the last ``days`` of the tenant's events.

    Returns ``{matches, sample, note}``. Requires the detection engine.
    """
    log.info("rule.backtest", tenant_id=current_tenant_id(), days=days)
    try:
        from aegis_detection.run import backtest  # noqa: PLC0415
    except ImportError:
        return {"matches": None, "sample": [], "note": "detection engine not installed yet"}
    return backtest(yaml.safe_load(rule_yaml), days=days, tenant_id=current_tenant_id())


@tool(name="rule_deploy")
def rule_deploy(rule_yaml: str) -> dict[str, Any]:
    """Deploy a detection rule as a LIVE OpenSearch Alerting monitor on the tenant's cluster.

    Compiles the rule YAML to a monitor and creates it via ``POST _plugins/_alerting/monitors``
    so it fires on live logs and appears in OpenSearch Dashboards → Alerting. Call this only
    after the analyst has confirmed they want the rule deployed.

    Returns ``{deployed, monitor_id, name, error?}``.
    """
    tenant_id = current_tenant_id()
    try:
        from aegis_core import get_settings, opensearch_for_tenant  # noqa: PLC0415
        from aegis_detection.monitor import rule_to_monitor  # noqa: PLC0415
    except ImportError as exc:  # noqa: BLE001
        return {"deployed": False, "error": f"detection engine unavailable: {exc}"}
    try:
        data = yaml.safe_load(rule_yaml)
        monitor = rule_to_monitor(data, tenant_id=tenant_id)
        resp = opensearch_for_tenant(tenant_id, get_settings()).create_monitor(monitor)
        monitor_id = resp.get("_id") or resp.get("id")
        log.info("rule.deploy", tenant_id=tenant_id, monitor_id=monitor_id, name=data.get("title"))
        return {"deployed": bool(monitor_id), "monitor_id": monitor_id, "name": data.get("title")}
    except Exception as exc:  # noqa: BLE001 - report the failure to the model
        log.error("rule.deploy.error", tenant_id=tenant_id, error=str(exc))
        return {"deployed": False, "error": str(exc)[:300]}
