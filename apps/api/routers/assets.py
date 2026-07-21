"""Assets API — inventory of hosts/users/cloud/identity entities."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from aegis_core import TenantContext, get_logger, get_settings, opensearch_for_tenant
from aegis_core.errors import NotFoundError

from apps.api.deps import CurrentTenant
from apps.api.errors import Problem
from apps.api.rbac import require_permission
from apps.api.schemas import AssetCreate
from apps.api.store import assets_repo

log = get_logger(__name__)
router = APIRouter(prefix="/assets", tags=["assets"])

AssetsWriter = Annotated[TenantContext, Depends(require_permission("assets:write"))]
_NOT_FOUND = {404: {"model": Problem, "description": "Asset not found"}}

# host/user names that read like servers/DCs are treated as higher criticality by default.
_HIGH_HOST_TOKENS = ("dc", "srv", "server", "ad", "vault", "db", "sql")


def _risk_from_events(events: int, categories: list[str]) -> int:
    """Heuristic risk from log volume + security-relevant categories (0–100)."""
    base = min(60, events // 5)
    if any(c in {"authentication", "intrusion_detection", "threat"} for c in categories):
        base += 20
    return max(5, min(100, base))


def _criticality(name: str, kind: str) -> str:
    lowered = name.lower()
    if kind == "host" and any(tok in lowered for tok in _HIGH_HOST_TOKENS):
        return "high"
    if kind == "user" and (lowered.startswith("svc") or "admin" in lowered or "backup" in lowered):
        return "high"
    return "normal"


def _discovered_asset(rec: dict[str, Any], kind: str) -> dict[str, Any]:
    name = rec["name"]
    attributes = {
        "events": rec.get("events", 0),
        "last_seen": rec.get("last_seen"),
        "first_seen": rec.get("first_seen"),
        "source_ips": rec.get("source_ips", []),
        "categories": rec.get("categories", []),
        "actions": rec.get("actions", []),
        "log_sources": rec.get("sources", []),
    }
    return {
        "id": f"os-{kind}-{name}",
        "kind": kind,
        "name": name,
        "criticality": _criticality(name, kind),
        "risk_score": _risk_from_events(int(rec.get("events", 0)), rec.get("categories", [])),
        "attributes": {k: v for k, v in attributes.items() if v not in (None, [], 0)},
        "discovered": True,
    }


@router.get("")
async def list_assets(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List the tenant's assets (manually curated inventory)."""
    return assets_repo.list(tenant.tenant_id)


@router.get("/discovered")
async def discover_assets(tenant: CurrentTenant) -> dict[str, Any]:
    """Discover assets from the tenant's OpenSearch logs (hosts + identities with device info).

    Aggregates ``host.name`` and ``user.name`` across the tenant's ``t-{tenant}-*`` indices so
    the inventory reflects what is actually emitting logs — no manual entry, no mocks. Degrades to
    ``available: false`` with an empty list when OpenSearch is unreachable or has no events yet.
    """
    client = opensearch_for_tenant(tenant.tenant_id, get_settings())
    try:
        hosts = client.discover_entities(tenant_id=tenant.tenant_id, field="host.name")
        users = client.discover_entities(tenant_id=tenant.tenant_id, field="user.name")
    except Exception as exc:  # noqa: BLE001 - unreachable store is a real UI state
        log.info("assets.discover.unavailable", tenant_id=tenant.tenant_id, error=str(exc)[:200])
        return {"available": False, "reason": "OpenSearch not connected or unreachable", "assets": []}

    assets = [_discovered_asset(h, "host") for h in hosts] + [_discovered_asset(u, "user") for u in users]
    if not assets:
        return {"available": False, "reason": "no host/user telemetry in the window", "assets": []}
    assets.sort(key=lambda a: a["risk_score"], reverse=True)
    return {"available": True, "assets": assets}


@router.post("", status_code=201)
async def create_asset(body: AssetCreate, tenant: AssetsWriter) -> dict[str, Any]:
    """Upsert an asset into inventory."""
    return assets_repo.create(tenant.tenant_id, {**body.model_dump(), "risk_score": 0})


@router.get("/{asset_id}", responses=_NOT_FOUND)
async def get_asset(asset_id: str, tenant: CurrentTenant) -> dict[str, Any]:
    """Fetch one asset."""
    asset = assets_repo.get(tenant.tenant_id, asset_id)
    if asset is None:
        raise NotFoundError(f"asset {asset_id} not found")
    return asset
