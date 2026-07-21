"""Native OpenSearch tools — tenant-scoped, mirroring the official OpenSearch MCP toolset
(opensearch-mcp-server-py) so the crew can inspect indices/mappings and run precise searches
without the MCP sidecar. Every call is constrained to the caller's ``t-{tenant}-*`` indices.
"""

from __future__ import annotations

from typing import Any

from agno.tools import tool

from aegis_core import current_tenant_id, get_settings, opensearch_for_tenant


def _client():  # noqa: ANN202 - OpenSearchClient
    return opensearch_for_tenant(current_tenant_id(), get_settings())


@tool(name="opensearch_search", show_result=True)
def opensearch_search(query_string: str, size: int = 50) -> list[dict[str, Any]]:
    """Full-text search the tenant's OpenSearch indices (Lucene ``query_string``).

    Args:
        query_string: e.g. ``event.action:failed_login AND source.ip:203.0.113.66``.
        size: Max hits to return (default 50).
    Returns: the matching documents' ``_source`` bodies.
    """
    tenant_id = current_tenant_id()
    return _client().search({"query_string": {"query": query_string}}, tenant_id=tenant_id, size=size)


@tool(name="opensearch_list_indices", show_result=True)
def opensearch_list_indices() -> list[dict[str, Any]]:
    """List the tenant's OpenSearch indices with doc counts and size (know what data exists)."""
    return _client().list_indices(current_tenant_id())


@tool(name="opensearch_index_mapping", show_result=True)
def opensearch_index_mapping() -> dict[str, Any]:
    """Return the field mappings for the tenant's indices (discover available fields to query)."""
    return _client().index_mapping(current_tenant_id())


@tool(name="opensearch_count", show_result=True)
def opensearch_count(query_string: str = "*") -> int:
    """Count documents matching a Lucene ``query_string`` in the tenant's indices."""
    tenant_id = current_tenant_id()
    return _client().count({"query_string": {"query": query_string}}, tenant_id=tenant_id)


@tool(name="opensearch_cluster_health", show_result=True)
def opensearch_cluster_health() -> dict[str, Any]:
    """Return the OpenSearch cluster health (status, node count) for the tenant's cluster."""
    return _client().cluster_health()
