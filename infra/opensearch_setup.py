"""Configure OpenSearch for Aegis: per-tenant index template + demo documents.

Creates the ``aegis-tenant-logs`` index template matching ``t-*-*`` (per-tenant prefix
isolation, docs/04 §3.3) and seeds a few demo security docs for the demo tenant so
search + Dashboards work immediately. Idempotent. Run: ``python infra/opensearch_setup.py``.
"""

from __future__ import annotations

import json
import urllib.request

from aegis_core import get_logger, get_settings

log = get_logger(__name__)
TENANT = "11111111-1111-1111-1111-111111111111"

TEMPLATE = {
    "index_patterns": ["t-*-*"],
    "template": {
        "settings": {"number_of_shards": 1, "number_of_replicas": 0},
        "mappings": {
            "properties": {
                "@timestamp": {"type": "date"},
                "tenant_id": {"type": "keyword"},
                "event": {"properties": {"category": {"type": "keyword"}, "action": {"type": "keyword"}}},
                "source": {"properties": {"ip": {"type": "ip"}}},
                "destination": {"properties": {"ip": {"type": "ip"}, "port": {"type": "integer"}}},
                "host": {"properties": {"name": {"type": "keyword"}}},
                "user": {"properties": {"name": {"type": "keyword"}}},
                "message": {"type": "text"},
            }
        },
    },
}

DOCS = [
    {"@timestamp": "2026-07-20T21:06:46Z", "tenant_id": TENANT, "event": {"category": "process", "action": "start"}, "host": {"name": "WIN-02"}, "user": {"name": "jane.doe"}, "message": "Suspicious PowerShell execution: encoded command accessing LSASS memory"},
    {"@timestamp": "2026-07-20T21:05:12Z", "tenant_id": TENANT, "event": {"category": "authentication", "action": "logon"}, "host": {"name": "WIN-02"}, "user": {"name": "jane.doe"}, "source": {"ip": "89.45.22.101"}, "message": "Interactive logon from external IP"},
    {"@timestamp": "2026-07-20T21:10:03Z", "tenant_id": TENANT, "event": {"category": "network", "action": "accept"}, "host": {"name": "fw01"}, "source": {"ip": "10.0.0.5"}, "destination": {"ip": "8.8.8.8", "port": 1057}, "message": "Allowed outbound connection"},
]


def _req(method: str, path: str, body: dict | None = None) -> dict:
    settings = get_settings()
    url = f"{settings.opensearch_url.rstrip('/')}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read() or b"{}")


def main() -> None:
    _req("PUT", "/_index_template/aegis-tenant-logs", TEMPLATE)
    index = f"t-{TENANT}-logs-2026.07.20"
    for i, doc in enumerate(DOCS):
        _req("PUT", f"/{index}/_doc/demo-{i}", doc)
    count = _req("GET", f"/t-{TENANT}-*/_count")
    log.info("opensearch.setup.done", template="aegis-tenant-logs", docs=count.get("count"))


if __name__ == "__main__":
    main()
