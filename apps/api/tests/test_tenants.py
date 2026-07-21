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


def test_rename_tenant_updates_directory_and_whoami(client, make_token):
    headers = _admin(make_token)
    body = {"name": "Acme SOC", "opensearch": {"url": "http://127.0.0.1:1", "user": "u", "password": "p"}}
    new_id = client.post("/api/v1/tenants", json=body, headers=headers).json()["tenant"]["id"]
    admin_new = {"Authorization": f"Bearer {make_token(tenant_id=new_id, permissions=['autonomy:write'])}"}

    resp = client.patch(f"/api/v1/tenants/{new_id}", json={"name": "Acme Security"}, headers=admin_new)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Acme Security"

    who = client.get("/api/v1/whoami", headers=admin_new).json()
    assert who["tenant_name"] == "Acme Security"
    assert who["email"] == "priya@acme.com"


def test_rename_other_tenant_is_404(client, make_token):
    headers = {"Authorization": f"Bearer {make_token(tenant_id='acme', permissions=['autonomy:write'])}"}
    resp = client.patch("/api/v1/tenants/some-other-tenant", json={"name": "x"}, headers=headers)
    assert resp.status_code == 404


def test_rename_requires_admin(client, make_token):
    resp = client.patch(
        "/api/v1/tenants/acme",
        json={"name": "x"},
        headers={"Authorization": f"Bearer {make_token(tenant_id='acme', permissions=['rules:read'])}"},
    )
    assert resp.status_code == 403


def test_bootstrap_creates_first_tenant_without_prior_tenant(client, make_token):
    # A freshly signed-up user has a valid JWT but NO tenant_id claim.
    token = make_token(tenant_id=None, permissions=[])
    headers = {"Authorization": f"Bearer {token}"}
    body = {"name": "Fresh Co", "opensearch": {"url": "http://127.0.0.1:1", "user": "u", "password": "p"}}
    resp = client.post("/api/v1/tenants/bootstrap", json=body, headers=headers)
    assert resp.status_code == 201
    payload = resp.json()
    assert payload["tenant"]["name"] == "Fresh Co"
    # Minted token carries the new tenant + admin permissions and the user's own sub.
    claims = jwt.decode(payload["token"], TEST_JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
    assert claims["tenant_id"] == payload["tenant"]["id"]
    assert claims["sub"] == "user-123"
    assert "autonomy:write" in claims["permissions"]


def test_bootstrap_requires_authentication(client):
    resp = client.post("/api/v1/tenants/bootstrap", json={"name": "x", "opensearch": {"url": "http://127.0.0.1:1"}})
    assert resp.status_code == 401


def test_test_source_open_to_any_authed_user(client, make_token):
    # No admin permission, no tenant — still allowed (it only pings, persists nothing).
    token = make_token(tenant_id=None, permissions=[])
    resp = client.post(
        "/api/v1/tenants/test-source",
        json={"opensearch": {"url": "http://127.0.0.1:1", "user": "u", "password": "p"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert "ok" in resp.json()


def test_onboard_requires_admin(client, make_token):
    resp = client.post(
        "/api/v1/tenants",
        json={"name": "x", "opensearch": {"url": "http://127.0.0.1:1"}},
        headers={"Authorization": f"Bearer {make_token(permissions=['rules:read'])}"},
    )
    assert resp.status_code == 403
