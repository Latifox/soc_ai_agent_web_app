"""Tests for ClickHouse backend selection and tenant-filter injection.

The actual ``chdb`` round-trip is skipped when ``chdb`` is not installed so the
suite runs in a minimal environment (see task guard).
"""

from __future__ import annotations

import importlib.util

import pytest

from aegis_core.clickhouse import (
    ChdbClickHouse,
    ServerClickHouse,
    build_tenant_scoped_query,
    get_clickhouse,
)
from aegis_core.errors import TenantIsolationError
from aegis_core.settings import Settings


def test_get_clickhouse_selects_chdb():
    ch = get_clickhouse(Settings(clickhouse_backend="chdb", chdb_path="./data/clickhouse"))
    assert isinstance(ch, ChdbClickHouse)
    assert ch.backend == "chdb"


def test_get_clickhouse_selects_server():
    ch = get_clickhouse(Settings(clickhouse_backend="server"))
    assert isinstance(ch, ServerClickHouse)
    assert ch.backend == "server"


def test_tenant_filter_injected_into_query():
    scoped_sql, params = build_tenant_scoped_query(
        "SELECT event_id, tenant_id FROM events WHERE severity = {sev:String}",
        {"sev": "high"},
        tenant_id="acme",
    )
    assert "WHERE tenant_id = {aegis_tenant:String}" in scoped_sql
    assert "_aegis_scoped" in scoped_sql
    assert params["aegis_tenant"] == "acme"
    assert params["sev"] == "high"


def test_missing_tenant_rejected():
    with pytest.raises(TenantIsolationError):
        build_tenant_scoped_query("SELECT 1", None, tenant_id="")


def test_trailing_semicolon_stripped():
    scoped_sql, _ = build_tenant_scoped_query("SELECT * FROM events;", None, tenant_id="acme")
    assert ";\n) AS _aegis_scoped" not in scoped_sql
    assert "FROM events\n)" in scoped_sql


@pytest.mark.skipif(importlib.util.find_spec("chdb") is None, reason="chdb not installed")
def test_chdb_round_trip_enforces_tenant(tmp_path):
    ch = ChdbClickHouse(path=str(tmp_path / "ch"), database="aegis")
    session = ch._get_session()  # noqa: SLF001 - test needs raw DDL/inserts
    session.query("CREATE DATABASE IF NOT EXISTS aegis")
    session.query(
        "CREATE TABLE IF NOT EXISTS aegis.demo (tenant_id String, v UInt32) "
        "ENGINE = MergeTree ORDER BY v"
    )
    session.query("INSERT INTO aegis.demo VALUES ('acme', 1), ('acme', 2), ('other', 9)")

    rows = ch.query("SELECT tenant_id, v FROM aegis.demo", tenant_id="acme")
    tenants = {row["tenant_id"] for row in rows}
    assert tenants == {"acme"}
    assert {row["v"] for row in rows} == {1, 2}
