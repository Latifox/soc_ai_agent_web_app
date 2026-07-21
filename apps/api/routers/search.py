"""Search API — tenant-scoped queries over ClickHouse or OpenSearch (investigations/hunting).

ClickHouse accepts a read-only SQL statement; OpenSearch accepts a Lucene ``query_string``.
Both are constrained to the caller's tenant by the underlying adapters.
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter

from aegis_core import clickhouse_for_tenant, federated_search, get_settings, opensearch_for_tenant
from aegis_core.errors import NotFoundError, PermissionDeniedError

from apps.api.deps import CurrentTenant
from apps.api.schemas import FederatedSearchRequest, SearchRequest
from apps.api.store import integrations_repo

router = APIRouter(prefix="/search", tags=["search"])

_READONLY = re.compile(r"^\s*(with|select)\b", re.IGNORECASE)
_FORBIDDEN = re.compile(r"\b(insert|alter|drop|delete|update|create|truncate|attach)\b", re.IGNORECASE)


@router.post("")
async def search(body: SearchRequest, tenant: CurrentTenant) -> dict[str, Any]:
    """Run a tenant-scoped search against ClickHouse or OpenSearch."""
    settings = get_settings()
    if body.engine == "clickhouse":
        if not _READONLY.match(body.query) or _FORBIDDEN.search(body.query):
            raise PermissionDeniedError("clickhouse search allows read-only SELECT/WITH only")
        rows = clickhouse_for_tenant(tenant.tenant_id, settings).query(body.query, tenant_id=tenant.tenant_id)
        return {"engine": "clickhouse", "count": len(rows), "rows": rows}
    query = {"query_string": {"query": body.query}}
    rows = opensearch_for_tenant(tenant.tenant_id, settings).search(query, tenant_id=tenant.tenant_id, size=body.size)
    return {"engine": "opensearch", "count": len(rows), "rows": rows}


@router.post("/federated")
async def federated(body: FederatedSearchRequest, tenant: CurrentTenant) -> dict[str, Any]:
    """Query an external SIEM (Splunk/Elastic/Sentinel) using the tenant's integration creds."""
    integration = next(
        (i for i in integrations_repo.list(tenant.tenant_id) if i.get("provider") == body.engine),
        None,
    )
    if integration is None:
        raise NotFoundError(f"no {body.engine} integration configured for this tenant")
    return federated_search(
        body.engine,
        body.query,
        tenant_id=tenant.tenant_id,
        connection=integration.get("config", {}),
        size=body.size,
    )
