"""Aegis MCP server for tenant-scoped, read-only ClickHouse queries."""

from __future__ import annotations

from mcp_clickhouse.server import main, mcp

__all__ = ["main", "mcp"]
