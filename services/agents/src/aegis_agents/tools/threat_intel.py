"""Threat-intel enrichment tool — normalized IOC reputation.

Thin Agno wrapper over :func:`aegis_core.lookup_ioc` (VirusTotal + AbuseIPDB when keys are
set; offline-safe ``unknown`` otherwise).
"""

from __future__ import annotations

from typing import Any, Literal

from agno.tools import tool

from aegis_core import current_tenant_id, get_logger, get_settings, lookup_ioc

log = get_logger(__name__)

IocKind = Literal["ip", "domain", "url", "hash"]


@tool(name="ioc_reputation", show_result=True)
def ioc_reputation(indicator: str, kind: IocKind = "ip") -> dict[str, Any]:
    """Look up reputation and context for an indicator of compromise.

    Args:
        indicator: The IOC value (an IP, domain, URL, or file hash).
        kind: One of ``ip``, ``domain``, ``url``, ``hash``.

    Returns:
        ``{indicator, kind, malicious, score, sources, note}``; ``malicious`` is ``None``
        when reputation is unknown (no provider configured/reachable).
    """
    log.info("ti.lookup", tenant_id=current_tenant_id(), kind=kind)
    return lookup_ioc(indicator, kind, get_settings())
