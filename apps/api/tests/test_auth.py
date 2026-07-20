"""Auth + tenant-context tests for the protected route."""

from __future__ import annotations


def test_protected_route_rejects_missing_token(client):
    resp = client.get("/api/v1/whoami")
    assert resp.status_code == 401
    assert resp.headers["content-type"].startswith("application/problem+json")
    body = resp.json()
    assert body["status"] == 401
    assert body["title"] == "Authentication Failed"


def test_protected_route_rejects_invalid_token(client):
    resp = client.get("/api/v1/whoami", headers={"Authorization": "Bearer not-a-jwt"})
    assert resp.status_code == 401
    assert resp.headers["content-type"].startswith("application/problem+json")


def test_protected_route_rejects_wrong_secret(client, make_token):
    token = make_token(secret="a-different-secret-that-is-long-enough-x")
    resp = client.get("/api/v1/whoami", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_protected_route_rejects_token_without_tenant(client, make_token):
    token = make_token(tenant_id=None)
    resp = client.get("/api/v1/whoami", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    assert resp.json()["status"] == 403


def test_protected_route_accepts_valid_token(client, make_token):
    token = make_token(tenant_id="acme", role="analyst", permissions=["rules:read", "cases:write"])
    resp = client.get("/api/v1/whoami", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["tenant_id"] == "acme"
    assert body["user_id"] == "user-123"
    assert body["role"] == "analyst"
    assert body["permissions"] == ["rules:read", "cases:write"]
