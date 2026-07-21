"""Tenant data-connector registry + live connectivity tests (OpenSearch).

The connector hub (``/integrations``) lets each tenant point Aegis at *their* OpenSearch
cluster — including a remote one their logs stream into — and grant the Argus crew access.
This module runs a real connectivity probe (``ping``) and holds a per-tenant registry of
granted connectors so the tools/detection query the tenant's own cluster
(``opensearch_for_tenant``) instead of the global default in
:class:`~aegis_core.settings.Settings`.

The registry is an in-process singleton (the API and crew share one process). ``httpx`` is
imported lazily so importing this module never requires it.
"""

from __future__ import annotations

import threading
import time
from typing import Any

from aegis_core.opensearch import OpenSearchClient, get_opensearch
from aegis_core.settings import Settings

Config = dict[str, Any]

# Providers whose config describes a first-party datastore the crew can query directly.
DATA_PROVIDERS = ("opensearch",)
# Providers that supply the tenant's own LLM credentials (bring-your-own-key).
LLM_PROVIDERS = ("openrouter",)
# Every provider that gets mirrored into the in-process connector registry.
REGISTRY_PROVIDERS = DATA_PROVIDERS + LLM_PROVIDERS


def opensearch_from_config(config: Config) -> OpenSearchClient:
    """Build an OpenSearch client from a connector config dict."""
    return OpenSearchClient(
        url=str(config.get("url", "http://localhost:9200")),
        user=str(config.get("user", "admin")),
        password=str(config.get("password", "admin")),
    )


def ping_opensearch(config: Config, *, timeout: float = 8.0) -> dict[str, Any]:
    """Ping an OpenSearch cluster (``GET /``). Returns a health dict with version."""
    import httpx  # noqa: PLC0415 - optional dependency, lazy

    url = str(config.get("url", "http://localhost:9200")).rstrip("/")
    user = str(config.get("user", "admin"))
    password = str(config.get("password", "admin"))
    started = time.perf_counter()
    with httpx.Client(timeout=timeout, verify=False) as client:  # noqa: S501 - self-signed OS dev certs
        resp = client.get(url, auth=(user, password))
        resp.raise_for_status()
        info = resp.json()
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    version = str(info.get("version", {}).get("number", "?"))
    name = str(info.get("cluster_name", url))
    return {"ok": True, "latency_ms": latency_ms, "detail": f"cluster {name} · v{version}"}


def ping_openrouter(config: Config, *, timeout: float = 8.0) -> dict[str, Any]:
    """Validate an OpenRouter API key (``GET /api/v1/key``). Returns health with any limits."""
    import httpx  # noqa: PLC0415 - optional dependency, lazy

    api_key = str(config.get("api_key") or "").strip()
    if not api_key:
        return {"ok": False, "detail": "no api key", "error": "OpenRouter API key is required"}
    started = time.perf_counter()
    with httpx.Client(timeout=timeout) as client:
        resp = client.get("https://openrouter.ai/api/v1/key", headers={"authorization": f"Bearer {api_key}"})
        resp.raise_for_status()
        data = resp.json().get("data", {})
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    label = str(data.get("label") or "key")
    limit = data.get("limit")
    detail = f"OpenRouter {label}" + (f" · limit {limit}" if limit is not None else " · unlimited")
    return {"ok": True, "latency_ms": latency_ms, "detail": detail}


def ping(provider: str, config: Config) -> dict[str, Any]:
    """Run the connectivity test for ``provider``; never raises — errors become health."""
    try:
        if provider == "opensearch":
            return ping_opensearch(config)
        if provider == "openrouter":
            return ping_openrouter(config)
        return {"ok": bool(config), "detail": "configuration present" if config else "no config"}
    except Exception as exc:  # noqa: BLE001 - surface the failure as health, not a 500
        return {"ok": False, "detail": type(exc).__name__, "error": str(exc)[:300]}


class ConnectorRegistry:
    """In-process map of ``(tenant_id, provider) -> {config, agent_access}``."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._store: dict[tuple[str, str], dict[str, Any]] = {}

    def set(self, tenant_id: str, provider: str, config: Config, *, agent_access: bool) -> None:
        with self._lock:
            self._store[(tenant_id, provider)] = {"config": dict(config or {}), "agent_access": agent_access}

    def remove(self, tenant_id: str, provider: str) -> None:
        with self._lock:
            self._store.pop((tenant_id, provider), None)

    def get(self, tenant_id: str, provider: str) -> dict[str, Any] | None:
        with self._lock:
            entry = self._store.get((tenant_id, provider))
            return dict(entry) if entry else None

    def config_for(self, tenant_id: str, provider: str) -> Config | None:
        """Return the config only when the tenant granted the crew access to it."""
        entry = self.get(tenant_id, provider)
        if entry and entry.get("agent_access") and entry.get("config"):
            return entry["config"]
        return None


registry = ConnectorRegistry()


def opensearch_for_tenant(tenant_id: str, settings: Settings) -> OpenSearchClient:
    """The tenant's granted OpenSearch connector, else the global default."""
    config = registry.config_for(tenant_id, "opensearch")
    if config:
        return opensearch_from_config(config)
    return get_opensearch(settings)


def openrouter_for_tenant(tenant_id: str | None, settings: Settings) -> dict[str, Any]:
    """Resolve the LLM credentials the crew should use for ``tenant_id``.

    Returns ``{"api_key", "model"}`` where a value is the tenant's own (from the ``openrouter``
    connector they saved in the web app, when granted to the crew) else the global default from
    settings. ``model`` is ``None`` unless the tenant pinned one — callers keep their tier ids
    when it is ``None``.
    """
    api_key = settings.openrouter_api_key or None
    model: str | None = None
    if tenant_id:
        config = registry.config_for(tenant_id, "openrouter")
        if config:
            api_key = str(config.get("api_key") or "").strip() or api_key
            model = str(config.get("model") or "").strip() or None
    return {"api_key": api_key, "model": model}
