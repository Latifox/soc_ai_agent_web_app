"""Reports are composed from live data and persisted."""

from __future__ import annotations


def _author(make_token):
    return {"Authorization": f"Bearer {make_token(permissions=['cases:write', 'incidents:write'])}"}


def test_generate_report_composes_and_persists(client, make_token):
    headers = _author(make_token)
    resp = client.post("/api/v1/reports/generate", json={"kind": "executive", "window_days": 30}, headers=headers)
    assert resp.status_code == 201
    report = resp.json()
    assert report["kind"] == "executive"
    assert "metrics" in report and "incidents" in report["metrics"]
    assert any(s["heading"] == "Summary" for s in report["sections"])

    listed = client.get("/api/v1/reports", headers={"Authorization": f"Bearer {make_token()}"})
    assert listed.status_code == 200
    assert any(r["id"] == report["id"] for r in listed.json())
