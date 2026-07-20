"""Search API — tenant-scoped queries over ClickHouse or OpenSearch (investigations/hunting).

ClickHouse accepts a read-only SQL statement; OpenSearch accepts a Lucene ``query_string``.
Both are constrained to the caller's tenant by the underlying adapters.
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter

from aegis_core import get_clickhouse, get_opensearch, get_settings
from aegis_core.errors import PermissionDeniedError

from apps.api.deps import CurrentTenant
from apps.api.schemas import SearchRequest

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
        rows = get_clickhouse(settings).query(body.query, tenant_id=tenant.tenant_id)
        return {"engine": "clickhouse", "count": len(rows), "rows": rows}
    query = {"query_string": {"query": body.query}}
    rows = get_opensearch(settings).search(query, tenant_id=tenant.tenant_id, size=body.size)
    return {"engine": "opensearch", "count": len(rows), "rows": rows}
