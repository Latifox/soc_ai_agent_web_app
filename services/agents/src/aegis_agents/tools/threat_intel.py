"""Threat-intel enrichment tool.

Normalizes IOC reputation across providers (VirusTotal / AbuseIPDB / OTX / MISP).
Offline-safe: when no provider is configured it returns an ``unknown`` verdict rather
than failing, so the crew runs end-to-end without external keys in local dev.
"""

from __future__ import annotations

from typing import Any, Literal

from agno.tools import tool

from aegis_core import current_tenant_id, get_logger

log = get_logger(__name__)

IocKind = Literal["ip", "domain", "url", "hash"]


@tool(name="ioc_reputation", show_result=True)
def ioc_reputation(indicator: str, kind: IocKind = "ip") -> dict[str, Any]:
    """Look up reputation and context for an indicator of compromise.

    Args:
        indicator: The IOC value (an IP, domain, URL, or file hash).
        kind: One of ``ip``, ``domain``, ``url``, ``hash``.

    Returns:
        A normalized verdict: ``{indicator, kind, malicious, score, sources, note}``.
        ``malicious`` is ``None`` when reputation is unknown (no provider configured).
    """
    log.info("ti.lookup", tenant_id=current_tenant_id(), kind=kind)
    # Providers are wired in when API keys are present (see docs/05 §10). Until then,
    # return a structured 'unknown' so investigation proceeds deterministically.
    return {
        "indicator": indicator,
        "kind": kind,
        "malicious": None,
        "score": None,
        "sources": [],
        "note": "no threat-intel provider configured; reputation unknown",
    }
