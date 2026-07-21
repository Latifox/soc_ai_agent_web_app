"""Search API — tenant-scoped queries over OpenSearch (investigations / hunting).

Accepts a Lucene ``query_string`` and runs it against the tenant's ``t-{tenant}-*`` indices
via the tenant's granted connector (or the default). Federated search delegates to an
external SIEM using the tenant's stored integration creds.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from aegis_core import federated_search, get_settings, opensearch_for_tenant
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.schemas import FederatedSearchRequest, SearchRequest
from apps.api.store import integrations_repo

router = APIRouter(prefix="/search", tags=["search"])


@router.post("")
async def search(body: SearchRequest, tenant: CurrentTenant) -> dict[str, Any]:
    """Run a tenant-scoped Lucene search against OpenSearch."""
    query = {"query_string": {"query": body.query or "*", "analyze_wildcard": True}}
    rows = opensearch_for_tenant(tenant.tenant_id, get_settings()).search(
        query, tenant_id=tenant.tenant_id, size=body.size
    )
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
