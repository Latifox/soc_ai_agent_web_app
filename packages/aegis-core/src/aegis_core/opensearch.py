"""OpenSearch client — the single telemetry/log + search store (tenant-scoped).

Every read/write is constrained to the caller's per-tenant index prefix ``t-{tenant}-*``
(defense in depth alongside OpenSearch document-level security). Logs stream in from the
field (Logstash/agents) and the detection engine, telemetry and evidence all read back
from here. ``httpx`` is imported lazily so importing this module never requires it.
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

    def _index(self, tenant_id: str, suffix: str = "*") -> str:
        if not tenant_id or not tenant_id.strip():
            raise TenantIsolationError("tenant_id is required for every OpenSearch query")
        return f"t-{tenant_id}-{suffix}"

    def _client(self):  # noqa: ANN202 - httpx client, lazy import
        import httpx  # noqa: PLC0415 - optional dependency, lazy

        return httpx.Client(timeout=15.0, verify=False)  # noqa: S501 - self-signed dev certs

    def search(self, query: dict[str, Any], *, tenant_id: str, size: int = 50) -> list[dict[str, Any]]:
        """Run a query DSL against the tenant's indices; return ``_source`` docs."""
        index = self._index(tenant_id)
        with self._client() as client:
            resp = client.post(f"{self._url}/{index}/_search", json={"query": query, "size": size}, auth=self._auth)
            if resp.status_code == 404:  # no indices yet for this tenant
                return []
            resp.raise_for_status()
            hits = resp.json().get("hits", {}).get("hits", [])
            return [hit.get("_source", {}) for hit in hits]

    def aggregate(self, query: dict[str, Any], aggs: dict[str, Any], *, tenant_id: str) -> dict[str, Any]:
        """Run an aggregation (size:0) and return the ``aggregations`` block."""
        index = self._index(tenant_id)
        body = {"size": 0, "query": query, "aggs": aggs}
        with self._client() as client:
            resp = client.post(f"{self._url}/{index}/_search", json=body, auth=self._auth)
            if resp.status_code == 404:
                return {}
            resp.raise_for_status()
            return resp.json().get("aggregations", {})

    def count(self, query: dict[str, Any], *, tenant_id: str) -> int:
        """Count documents matching ``query`` in the tenant's indices."""
        index = self._index(tenant_id)
        with self._client() as client:
            resp = client.post(f"{self._url}/{index}/_count", json={"query": query}, auth=self._auth)
            if resp.status_code == 404:
                return 0
            resp.raise_for_status()
            return int(resp.json().get("count", 0))

    def index_doc(
        self, doc: dict[str, Any], *, tenant_id: str, suffix: str, doc_id: str | None = None
    ) -> dict[str, Any]:
        """Index ``doc`` into ``t-{tenant}-{suffix}`` (refresh=true). Returns the response."""
        index = self._index(tenant_id, suffix)
        path = f"{index}/_doc/{doc_id}" if doc_id else f"{index}/_doc"
        with self._client() as client:
            resp = client.request(
                "PUT" if doc_id else "POST",
                f"{self._url}/{path}",
                params={"refresh": "true"},
                json=doc,
                auth=self._auth,
            )
            resp.raise_for_status()
            return resp.json()

    def bulk_index(self, docs: list[dict[str, Any]], *, tenant_id: str, suffix: str) -> int:
        """Bulk-index ``docs`` into ``t-{tenant}-{suffix}`` (refresh=true). Returns count."""
        if not docs:
            return 0
        import json  # noqa: PLC0415

        index = self._index(tenant_id, suffix)
        lines: list[str] = []
        for doc in docs:
            lines.append(json.dumps({"index": {"_index": index}}))
            lines.append(json.dumps(doc, default=str))
        payload = "\n".join(lines) + "\n"
        with self._client() as client:
            resp = client.post(
                f"{self._url}/_bulk",
                params={"refresh": "true"},
                content=payload,
                headers={"content-type": "application/x-ndjson"},
                auth=self._auth,
            )
            resp.raise_for_status()
            return len(docs)


    # ── OpenSearch Alerting (monitors) — cluster-level plugin API ────────────
    def create_monitor(self, monitor: dict[str, Any]) -> dict[str, Any]:
        """Create an alerting monitor (``POST _plugins/_alerting/monitors``)."""
        with self._client() as client:
            resp = client.post(f"{self._url}/_plugins/_alerting/monitors", json=monitor, auth=self._auth)
            resp.raise_for_status()
            return resp.json()

    def get_monitor(self, monitor_id: str) -> dict[str, Any] | None:
        """Fetch one monitor (``GET _plugins/_alerting/monitors/{id}``)."""
        with self._client() as client:
            resp = client.get(f"{self._url}/_plugins/_alerting/monitors/{monitor_id}", auth=self._auth)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()

    def update_monitor(self, monitor_id: str, monitor: dict[str, Any]) -> dict[str, Any]:
        """Update an existing monitor (``PUT _plugins/_alerting/monitors/{id}``)."""
        with self._client() as client:
            resp = client.put(f"{self._url}/_plugins/_alerting/monitors/{monitor_id}", json=monitor, auth=self._auth)
            resp.raise_for_status()
            return resp.json()

    def delete_monitor(self, monitor_id: str) -> bool:
        with self._client() as client:
            resp = client.delete(f"{self._url}/_plugins/_alerting/monitors/{monitor_id}", auth=self._auth)
            return resp.status_code < 300

    def list_monitors(self, size: int = 100) -> list[dict[str, Any]]:
        """List monitors (``GET _plugins/_alerting/monitors/_search``)."""
        body = {"size": size, "query": {"match_all": {}}}
        with self._client() as client:
            resp = client.post(f"{self._url}/_plugins/_alerting/monitors/_search", json=body, auth=self._auth)
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            hits = resp.json().get("hits", {}).get("hits", [])
            out: list[dict[str, Any]] = []
            for h in hits:
                m = h.get("_source", {}).get("monitor", h.get("_source", {}))
                out.append({
                    "id": h.get("_id"),
                    "name": m.get("name"),
                    "enabled": m.get("enabled"),
                    "monitor_type": m.get("monitor_type"),
                    "schedule": m.get("schedule"),
                })
            return out


def get_opensearch(settings: Settings) -> OpenSearchClient:
    """Construct the OpenSearch client from settings."""
    return OpenSearchClient(settings.opensearch_url, settings.opensearch_user, settings.opensearch_password)
