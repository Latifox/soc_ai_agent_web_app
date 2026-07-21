"""Deploying a rule to an integration binds + enables it, and rejects bad targets."""

from __future__ import annotations


def _writer(make_token):
    return {"Authorization": f"Bearer {make_token(permissions=['rules:write', 'integrations:write'])}"}


def _make_rule(client, headers) -> str:
    body = {"title": "Port scan", "type": "query", "severity": "medium", "yaml": "title: Port scan\ntype: query\nquery: '*'"}
    return client.post("/api/v1/rules", json=body, headers=headers).json()["id"]


def test_apply_binds_and_enables_on_connected_integration(client, make_token):
    headers = _writer(make_token)
    rid = _make_rule(client, headers)
    integ = client.post(
        "/api/v1/integrations",
        json={"provider": "fortinet", "name": "FortiGate", "config": {"host": "fw"}},
        headers=headers,
    ).json()
    client.post(f"/api/v1/integrations/{integ['id']}/test", headers=headers)  # -> connected (config present)

    resp = client.post(f"/api/v1/rules/{rid}/apply", json={"integration": "fortinet"}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["integration"] == "fortinet"
    assert body["enabled"] is True
    assert "applied_at" in body


def test_apply_unknown_integration_is_404(client, make_token):
    headers = _writer(make_token)
    rid = _make_rule(client, headers)
    resp = client.post(f"/api/v1/rules/{rid}/apply", json={"integration": "splunk"}, headers=headers)
    assert resp.status_code == 404
