"""MCP server: normalized IOC reputation over VirusTotal + AbuseIPDB.

Exposes ``ioc_reputation(indicator, kind)`` over MCP. Offline-safe (returns ``unknown``
when no provider key is configured). Run ``mcp-threatintel`` (stdio) or with ``--http``.
"""

from __future__ import annotations

import sys
from typing import Any, Literal

from mcp.server.fastmcp import FastMCP

from aegis_core import get_settings, lookup_ioc

mcp = FastMCP("aegis-threatintel")

IocKind = Literal["ip", "domain", "url", "hash"]


@mcp.tool()
def ioc_reputation(indicator: str, kind: IocKind = "ip") -> dict[str, Any]:
    """Return normalized reputation for an IOC (ip/domain/url/hash)."""
    return lookup_ioc(indicator, kind, get_settings())


def main() -> None:
    """Entry point. ``--http`` serves streamable-http; default is stdio."""
    mcp.run(transport="streamable-http") if "--http" in sys.argv else mcp.run()


if __name__ == "__main__":
    main()
