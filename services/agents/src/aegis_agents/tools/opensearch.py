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


@tool(name="opensearch_search")
def opensearch_search(query_string: str, size: int = 50) -> list[dict[str, Any]]:
    """Full-text search the tenant's OpenSearch indices (Lucene ``query_string``).

    Args:
        query_string: e.g. ``event.action:failed_login AND source.ip:203.0.113.66``.
        size: Max hits to return (default 50).
    Returns: the matching documents' ``_source`` bodies.
    """
    tenant_id = current_tenant_id()
    return _client().search({"query_string": {"query": query_string}}, tenant_id=tenant_id, size=size)


@tool(name="opensearch_list_indices")
def opensearch_list_indices() -> list[dict[str, Any]]:
    """List the tenant's OpenSearch indices with doc counts and size (know what data exists)."""
    return _client().list_indices(current_tenant_id())


def _flatten_fields(props: dict[str, Any], prefix: str = "") -> dict[str, str]:
    """Flatten a nested OpenSearch mapping into compact ``dotted.path -> type`` pairs."""
    out: dict[str, str] = {}
    for name, spec in (props or {}).items():
        path = f"{prefix}{name}"
        if isinstance(spec, dict) and "properties" in spec:
            out.update(_flatten_fields(spec["properties"], f"{path}."))
        elif isinstance(spec, dict) and "type" in spec:
            out[path] = spec["type"]
    return out


@tool(name="opensearch_index_mapping")
def opensearch_index_mapping() -> dict[str, str]:
    """List the queryable fields for the tenant's indices as compact ``field: type`` pairs
    (e.g. ``{"source.ip": "ip", "event.action": "keyword"}``) — use to discover fields to query."""
    raw = _client().index_mapping(current_tenant_id())
    fields: dict[str, str] = {}
    for index in (raw or {}).values():
        props = (index.get("mappings") or {}).get("properties") or {}
        fields.update(_flatten_fields(props))
    return fields


@tool(name="opensearch_count")
def opensearch_count(query_string: str = "*") -> int:
    """Count documents matching a Lucene ``query_string`` in the tenant's indices."""
    tenant_id = current_tenant_id()
    return _client().count({"query_string": {"query": query_string}}, tenant_id=tenant_id)


@tool(name="opensearch_cluster_health")
def opensearch_cluster_health() -> dict[str, Any]:
    """Return the OpenSearch cluster health (status, node count) for the tenant's cluster."""
    return _client().cluster_health()
