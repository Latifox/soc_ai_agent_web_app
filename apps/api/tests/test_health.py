"""Health-probe and OpenAPI tests."""

from __future__ import annotations


def test_healthz_ok(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_readyz_ok(client):
    resp = client.get("/readyz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


def test_openapi_served(client):
    resp = client.get("/api/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()
    assert schema["info"]["title"] == "Aegis API"
    assert "/api/v1/whoami" in schema["paths"]


def test_v1_root(client):
    resp = client.get("/api/v1/")
    assert resp.status_code == 200
    assert resp.json()["version"] == "v1"
