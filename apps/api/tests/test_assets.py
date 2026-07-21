"""Assets: manual inventory CRUD + OpenSearch-backed discovery degradation."""

from __future__ import annotations


def _writer(make_token):
    return {"Authorization": f"Bearer {make_token(permissions=['assets:write'])}"}


def test_discovery_degrades_when_opensearch_unreachable(client, make_token):
    # No OpenSearch in tests → discovery reports unavailable with an empty list, never 500.
    resp = client.get("/api/v1/assets/discovered", headers={"Authorization": f"Bearer {make_token()}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is False
    assert body["assets"] == []
    assert body["reason"]


def test_manual_asset_create_and_list(client, make_token):
    headers = _writer(make_token)
    created = client.post("/api/v1/assets", json={"kind": "host", "name": "WEB-01", "criticality": "high"}, headers=headers)
    assert created.status_code == 201
    listing = client.get("/api/v1/assets", headers={"Authorization": f"Bearer {make_token()}"})
    assert any(a["name"] == "WEB-01" for a in listing.json())
