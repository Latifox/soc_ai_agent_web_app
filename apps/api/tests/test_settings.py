"""Tenant settings: defaults, partial deep-merge persistence, and RBAC on writes."""

from __future__ import annotations


def test_get_returns_defaults(client, make_token):
    resp = client.get("/api/v1/settings", headers={"Authorization": f"Bearer {make_token()}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["org_name"] and body["detection"]["retention_days"] == 90


def test_put_deep_merges_and_persists(client, make_token):
    admin = {"Authorization": f"Bearer {make_token(permissions=['autonomy:write'])}"}
    put = client.put("/api/v1/settings", json={"org_name": "Acme SOC", "detection": {"retention_days": 180}}, headers=admin)
    assert put.status_code == 200
    body = put.json()
    assert body["org_name"] == "Acme SOC"
    assert body["detection"]["retention_days"] == 180
    # Untouched nested fields keep their defaults.
    assert body["detection"]["default_severity"] == "medium"

    again = client.get("/api/v1/settings", headers={"Authorization": f"Bearer {make_token()}"})
    assert again.json()["org_name"] == "Acme SOC"


def test_put_requires_admin_permission(client, make_token):
    resp = client.put("/api/v1/settings", json={"org_name": "x"}, headers={"Authorization": f"Bearer {make_token(permissions=['rules:read'])}"})
    assert resp.status_code == 403
