"""Threat-intel enrichment — normalized IOC reputation across providers.

Queries VirusTotal (ip/domain/url/hash) and AbuseIPDB (ip) when their API keys are set,
merges them into one verdict, and is offline-safe (returns ``unknown`` when nothing is
configured). Shared by the Agno ``ioc_reputation`` tool and the ``mcp-threatintel`` server.
``httpx`` is imported lazily.
"""

from __future__ import annotations

from typing import Any, Literal

from aegis_core.logging import get_logger
from aegis_core.settings import Settings

log = get_logger(__name__)

IocKind = Literal["ip", "domain", "url", "hash"]
_VT_PATH = {"ip": "ip_addresses", "domain": "domains", "url": "urls", "hash": "files"}


def _virustotal(indicator: str, kind: IocKind, api_key: str) -> dict[str, Any] | None:
    import httpx  # noqa: PLC0415

    path = _VT_PATH[kind]
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                f"https://www.virustotal.com/api/v3/{path}/{indicator}",
                headers={"x-apikey": api_key},
            )
        if resp.status_code == 404:
            return {"source": "virustotal", "found": False}
        resp.raise_for_status()
        stats = resp.json().get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
        malicious = int(stats.get("malicious", 0))
        total = sum(int(v) for v in stats.values()) or 1
        return {"source": "virustotal", "found": True, "malicious": malicious, "ratio": malicious / total}
    except httpx.HTTPError as exc:  # noqa: PERF203
        log.warning("ti.virustotal.error", error=str(exc))
        return None


def _abuseipdb(indicator: str, api_key: str) -> dict[str, Any] | None:
    import httpx  # noqa: PLC0415

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                "https://api.abuseipdb.com/api/v2/check",
                params={"ipAddress": indicator, "maxAgeInDays": 90},
                headers={"Key": api_key, "Accept": "application/json"},
            )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        return {"source": "abuseipdb", "found": True, "score": int(data.get("abuseConfidenceScore", 0))}
    except httpx.HTTPError as exc:
        log.warning("ti.abuseipdb.error", error=str(exc))
        return None


def lookup_ioc(indicator: str, kind: IocKind, settings: Settings) -> dict[str, Any]:
    """Return a normalized verdict for ``indicator``.

    ``{indicator, kind, malicious, score, sources, note}`` — ``malicious`` is ``None`` when
    no provider is configured or reachable.
    """
    sources: list[dict[str, Any]] = []
    if settings.virustotal_api_key and (vt := _virustotal(indicator, kind, settings.virustotal_api_key)):
        sources.append(vt)
    if kind == "ip" and settings.abuseipdb_api_key and (ab := _abuseipdb(indicator, settings.abuseipdb_api_key)):
        sources.append(ab)

    if not sources:
        return {
            "indicator": indicator,
            "kind": kind,
            "malicious": None,
            "score": None,
            "sources": [],
            "note": "no threat-intel provider configured; reputation unknown",
        }

    vt_ratio = next((s["ratio"] for s in sources if s.get("source") == "virustotal" and s.get("found")), 0.0)
    abuse = next((s["score"] / 100 for s in sources if s.get("source") == "abuseipdb"), 0.0)
    score = round(max(vt_ratio, abuse), 3)
    return {
        "indicator": indicator,
        "kind": kind,
        "malicious": score >= 0.5,
        "score": score,
        "sources": sources,
        "note": None,
    }
