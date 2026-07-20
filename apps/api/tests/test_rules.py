"""Rules router: CRUD, tenant isolation, and RBAC (offline — in-memory store)."""

from __future__ import annotations

_YAML = "title: t\ntype: query\nseverity: low\nquery: user.name:jane.doe"


def test_rules_crud_isolation_and_rbac(client, make_token) -> None:
    acme = {"Authorization": f"Bearer {make_token(tenant_id='acme', permissions=['rules:read', 'rules:write'])}"}

    created = client.post("/api/v1/rules", headers=acme, json={"title": "t", "yaml": _YAML})
    assert created.status_code == 201
    rule_id = created.json()["id"]
    assert created.json()["version"] == 1

    listed = client.get("/api/v1/rules", headers=acme)
    assert listed.status_code == 200
    assert any(r["id"] == rule_id for r in listed.json())

    # Another tenant cannot see or fetch it.
    other = {"Authorization": f"Bearer {make_token(tenant_id='other', permissions=['rules:read'])}"}
    assert client.get("/api/v1/rules", headers=other).json() == []
    assert client.get(f"/api/v1/rules/{rule_id}", headers=other).status_code == 404

    # Read-only principal cannot write.
    ro = {"Authorization": f"Bearer {make_token(tenant_id='acme', permissions=['rules:read'])}"}
    assert client.post("/api/v1/rules", headers=ro, json={"title": "x", "yaml": _YAML}).status_code == 403


def test_rules_requires_auth(client) -> None:
    assert client.get("/api/v1/rules").status_code == 401
