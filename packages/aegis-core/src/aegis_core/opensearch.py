"""OpenSearch search adapter — tenant-scoped by index prefix ``t-{tenant}-*``.

Search + federation surface. Every search is constrained to the caller's per-tenant index
prefix (defense in depth alongside OpenSearch document-level security). ``httpx`` is
imported lazily so importing this module never requires it.
"""

from __future__ import annotations

from typing import Any

from aegis_core.errors import TenantIsolationError
from aegis_core.settings import Settings


class OpenSearchClient:
    """Minimal tenant-scoped OpenSearch client over the REST API."""

    def __init__(self, url: str, user: str, password: str) -> None:
        self._url = url.rstrip("/")
        self._auth = (user, password)

    def _index(self, tenant_id: str) -> str:
        if not tenant_id or not tenant_id.strip():
            raise TenantIsolationError("tenant_id is required for every OpenSearch query")
        return f"t-{tenant_id}-*"

    def search(self, query: dict[str, Any], *, tenant_id: str, size: int = 50) -> list[dict[str, Any]]:
        """Run a query DSL against the tenant's indices; return ``_source`` docs."""
        import httpx  # noqa: PLC0415 - optional dependency, lazy

        index = self._index(tenant_id)
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{self._url}/{index}/_search",
                json={"query": query, "size": size},
                auth=self._auth,
            )
            resp.raise_for_status()
            hits = resp.json().get("hits", {}).get("hits", [])
            return [hit.get("_source", {}) for hit in hits]


def get_opensearch(settings: Settings) -> OpenSearchClient:
    """Construct the OpenSearch client from settings."""
    return OpenSearchClient(settings.opensearch_url, settings.opensearch_user, settings.opensearch_password)
