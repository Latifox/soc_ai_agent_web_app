"""Federated SIEM search — query external estates without ingesting (docs/05 §9).

Adapters for Elastic, Splunk, and Microsoft Sentinel. Each takes a per-tenant
``connection`` (from the tenant's integration config) and returns normalized rows, so
rules/agents treat federated results like local events. ``httpx`` is imported lazily and
failures are returned (not raised) so a hunt degrades gracefully.
"""

from __future__ import annotations

import json
from typing import Any, Literal

from aegis_core.errors import ConfigurationError, TenantIsolationError
from aegis_core.logging import get_logger

log = get_logger(__name__)

Engine = Literal["elastic", "splunk", "sentinel"]


def _elastic(conn: dict[str, Any], query: str, size: int) -> list[dict[str, Any]]:
    import httpx  # noqa: PLC0415

    url = conn["url"].rstrip("/")
    index = conn.get("index", "*")
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            f"{url}/{index}/_search",
            json={"query": {"query_string": {"query": query}}, "size": size},
            headers={"authorization": conn.get("auth", "")},
        )
        resp.raise_for_status()
        return [h.get("_source", {}) for h in resp.json().get("hits", {}).get("hits", [])]


def _splunk(conn: dict[str, Any], query: str, size: int) -> list[dict[str, Any]]:
    import httpx  # noqa: PLC0415

    url = conn["url"].rstrip("/")
    with httpx.Client(timeout=60.0, verify=conn.get("verify", True)) as client:  # noqa: S501
        resp = client.post(
            f"{url}/services/search/jobs/export",
            data={"search": f"search {query} | head {size}", "output_mode": "json"},
            headers={"authorization": f"Bearer {conn.get('token', '')}"},
        )
        resp.raise_for_status()
        rows: list[dict[str, Any]] = []
        for line in resp.text.splitlines():
            if line.strip():
                try:
                    rows.append(json.loads(line).get("result", {}))
                except json.JSONDecodeError:
                    continue
        return rows


def _sentinel(conn: dict[str, Any], query: str, size: int) -> list[dict[str, Any]]:
    import httpx  # noqa: PLC0415

    workspace = conn["workspace_id"]
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(
            f"https://api.loganalytics.io/v1/workspaces/{workspace}/query",
            json={"query": f"{query} | take {size}"},
            headers={"authorization": f"Bearer {conn.get('token', '')}"},
        )
        resp.raise_for_status()
        rows: list[dict[str, Any]] = []
        for table in resp.json().get("tables", []):
            cols = [c["name"] for c in table.get("columns", [])]
            rows.extend(dict(zip(cols, r, strict=False)) for r in table.get("rows", []))
        return rows


_ADAPTERS = {"elastic": _elastic, "splunk": _splunk, "sentinel": _sentinel}


def federated_search(
    engine: Engine,
    query: str,
    *,
    tenant_id: str,
    connection: dict[str, Any],
    size: int = 50,
) -> dict[str, Any]:
    """Search an external SIEM for a tenant. Returns ``{engine, count, rows[, error]}``."""
    if not tenant_id or not tenant_id.strip():
        raise TenantIsolationError("tenant_id is required for federated search")
    adapter = _ADAPTERS.get(engine)
    if adapter is None:
        raise ConfigurationError(f"unknown federation engine: {engine!r}")
    log.info("federation.search", tenant_id=tenant_id, engine=engine)
    try:
        rows = adapter(connection, query, size)
        return {"engine": engine, "count": len(rows), "rows": rows}
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        log.warning("federation.error", tenant_id=tenant_id, engine=engine, error=str(exc))
        return {"engine": engine, "count": 0, "rows": [], "error": str(exc)}
