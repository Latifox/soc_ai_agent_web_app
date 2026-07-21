"""Connector hub: CRUD, live test probe, and crew-access grant into the registry."""

from __future__ import annotations

from aegis_core import connector_registry


def _admin(make_token):
    return {"Authorization": f"Bearer {make_token(permissions=['integrations:write'])}"}


def test_add_clickhouse_connector_registers_agent_access(client, make_token):
    headers = _admin(make_token)
    body = {
        "provider": "clickhouse",
        "name": "ClickHouse",
        "config": {"host": "localhost", "port": 8123, "database": "aegis", "agent_access": True},
    }
    resp = client.post("/api/v1/integrations", json=body, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["status"] == "disconnected"
    # Creating a data connector with access granted makes it visible to the crew tools.
    assert connector_registry.config_for("acme", "clickhouse") is not None


def test_test_endpoint_reports_error_health_when_unreachable(client, make_token):
    headers = _admin(make_token)
    created = client.post(
        "/api/v1/integrations",
        json={"provider": "opensearch", "name": "OpenSearch", "config": {"url": "http://127.0.0.1:1"}},
        headers=headers,
    ).json()
    resp = client.post(f"/api/v1/integrations/{created['id']}/test", headers=headers)
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "error"
    assert payload["health"]["ok"] is False


def test_revoke_agent_access_hides_connector_from_crew(client, make_token):
    headers = _admin(make_token)
    created = client.post(
        "/api/v1/integrations",
        json={"provider": "clickhouse", "name": "CH", "config": {"host": "localhost", "agent_access": True}},
        headers=headers,
    ).json()
    assert connector_registry.config_for("acme", "clickhouse") is not None
    client.patch(
        f"/api/v1/integrations/{created['id']}",
        json={"config": {"host": "localhost", "agent_access": False}},
        headers=headers,
    )
    assert connector_registry.config_for("acme", "clickhouse") is None
