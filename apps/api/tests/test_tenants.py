"""Tenant onboarding: create a workspace + its OpenSearch source, mint a token, gate writes."""

from __future__ import annotations

import jwt

from apps.api.tests.conftest import TEST_JWT_SECRET


def _admin(make_token):
    return {"Authorization": f"Bearer {make_token(permissions=['autonomy:write'])}"}


def test_onboard_creates_tenant_source_and_token(client, make_token):
    headers = _admin(make_token)
    body = {"name": "Acme SOC", "opensearch": {"url": "http://127.0.0.1:1", "user": "u", "password": "p"}}
    resp = client.post("/api/v1/tenants", json=body, headers=headers)
    assert resp.status_code == 201
    payload = resp.json()
    assert payload["tenant"]["name"] == "Acme SOC"
    new_id = payload["tenant"]["id"]

    # The minted token carries the new tenant_id + admin permissions.
    claims = jwt.decode(payload["token"], TEST_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
    assert claims["tenant_id"] == new_id
    assert "autonomy:write" in claims["permissions"]

    # The new tenant appears in the directory and has an OpenSearch integration.
    listing = client.get("/api/v1/tenants", headers={"Authorization": f"Bearer {make_token()}"})
    assert any(t["id"] == new_id for t in listing.json())
    ints = client.get("/api/v1/integrations", headers={"Authorization": f"Bearer {make_token(tenant_id=new_id)}"})
    assert any(i["provider"] == "opensearch" for i in ints.json())


def test_onboard_requires_admin(client, make_token):
    resp = client.post(
        "/api/v1/tenants",
        json={"name": "x", "opensearch": {"url": "http://127.0.0.1:1"}},
        headers={"Authorization": f"Bearer {make_token(permissions=['rules:read'])}"},
    )
    assert resp.status_code == 403
