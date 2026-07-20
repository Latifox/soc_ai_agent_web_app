"""OpenSearch search tool — tenant-scoped full-text/correlation over ``t-{tenant}-*``.

Complements the upstream ``opensearch-agent-server`` MCP layer (docs/10): this is a
lightweight native tool for direct query_string / DSL searches, always scoped to the
caller's tenant indices.
"""

from __future__ import annotations

from typing import Any

from agno.tools import tool

from aegis_core import current_tenant_id, get_opensearch, get_settings


@tool(name="opensearch_search", show_result=True)
def opensearch_search(query_string: str, size: int = 50) -> list[dict[str, Any]]:
    """Full-text search the tenant's OpenSearch indices.

    Args:
        query_string: A Lucene ``query_string`` (e.g. ``event.action:accept AND host.name:WIN-02``).
        size: Max hits to return (default 50).

    Returns:
        The matching documents' ``_source`` bodies.
    """
    query = {"query_string": {"query": query_string}}
    return get_opensearch(get_settings()).search(query, tenant_id=current_tenant_id(), size=size)
