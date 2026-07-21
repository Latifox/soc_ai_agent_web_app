"""Dev seed — realistic SOC data for the demo tenant, loaded at startup in dev.

Populates the tenant-scoped store so every UI page renders real API data (no frontend
mocks). Idempotent: skips if the tenant already has rules. Tenant id matches
``infra/supabase/seed.sql`` so Supabase JWT claims line up end-to-end.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from apps.api.store import (
    approvals_repo,
    assets_repo,
    autonomy_repo,
    cases_repo,
    incidents_repo,
    integrations_repo,
    rules_repo,
)

DEMO_TENANT = "11111111-1111-1111-1111-111111111111"


def _ago(hours: float) -> str:
    return (datetime.now(UTC) - timedelta(hours=hours)).isoformat()


_RULES: list[dict[str, Any]] = [
    {
        "title": "Potential Credential Dumping via LSASS Access",
        "severity": "high", "type": "query", "enabled": True, "version": 3,
        "tags": ["credential_access", "windows", "T1003.001"],
        "author": "admin@demo.local",
        "yaml": "title: Potential Credential Dumping via LSASS Access\nseverity: high\ntype: query\ndepth: 15m\nquery: event.category:process AND process.name:lsass.exe AND event.action:access",
    },
    {
        "title": "Systems using many different protocols",
        "severity": "low", "type": "advanced_threshold", "enabled": True, "version": 1,
        "tags": ["attack.initial_access", "TDR-3006", "discovery", "T1046"],
        "author": "admin@demo.local",
        "yaml": "title: Systems using many different protocols\nseverity: low\ntype: advanced_threshold\ndepth: 1h\nquery: event.category:network AND event.action:accept\nthreshold:\n  group_by: [source.ip]\n  aggregate: cardinality(destination.port)\n  operator: \">\"\n  value: 50",
    },
    {
        "title": "Impossible Travel Sign-in Activity",
        "severity": "medium", "type": "code", "enabled": True, "version": 2,
        "tags": ["initial_access", "o365", "T1078"],
        "author": "diego@demo.local",
        "yaml": "title: Impossible Travel Sign-in Activity\nseverity: medium\ntype: code\ndepth: 1h\nquery: event.category:authentication",
    },
    {
        "title": "MFA Fatigue — Excessive Push Requests",
        "severity": "high", "type": "advanced_threshold", "enabled": True, "version": 1,
        "tags": ["credential_access", "T1621", "okta"],
        "author": "diego@demo.local",
        "yaml": "title: MFA Fatigue\nseverity: high\ntype: advanced_threshold\ndepth: 30m\nquery: event.category:authentication AND event.action:mfa_push\nthreshold:\n  group_by: [user.name]\n  aggregate: count()\n  operator: \">\"\n  value: 10",
    },
    {
        "title": "Outbound Connection to Known-Bad Domain",
        "severity": "medium", "type": "threat_match", "enabled": False, "version": 5,
        "tags": ["command_and_control", "T1071"],
        "author": "admin@demo.local",
        "yaml": "title: Outbound Connection to Known-Bad Domain\nseverity: medium\ntype: threat_match\ndepth: 15m\nquery: event.category:network AND event.type:dns",
    },
    {
        "title": "Kerberos Password Spraying",
        "severity": "medium", "type": "spark", "enabled": True, "version": 2,
        "tags": ["T1110.003", "brute_force", "windows"],
        "author": "diego@demo.local",
        "yaml": "title: Kerberos Password Spraying\nseverity: medium\ntype: spark\ndepth: 4h\nquery: event.code:4771",
    },
]

_INCIDENTS: list[dict[str, Any]] = [
    {
        "title": "Windows DC Sync Attack Detected", "severity": "high", "status": "open",
        "assignee": "priya@demo.local", "tags": ["DC Sync", "Active Directory", "Credential Theft"],
        "description": "An attacker emulated a Domain Controller to request password hashes via DRSUAPI.",
        "detected_at": _ago(3), "rule_title": "Potential Credential Dumping via LSASS Access",
        "entities": ["WIN-DC-01", "svc-backup"],
    },
    {
        "title": "Impossible Travel Activity in Office 365", "severity": "medium", "status": "open",
        "assignee": "sam@demo.local", "tags": ["Impossible Travel", "O365", "Account Compromise"],
        "description": "User signed in from two countries within 15 minutes (US → DE).",
        "detected_at": _ago(7), "rule_title": "Impossible Travel Sign-in Activity",
        "entities": ["jane.doe"],
    },
    {
        "title": "MFA Fatigue Attack Detected", "severity": "high", "status": "resolved",
        "assignee": "priya@demo.local", "tags": ["MFA Fatigue", "Credential Stuffing", "Phishing"],
        "description": "Credential-stuffing driven MFA push storm; user approved on 14th attempt.",
        "detected_at": _ago(26), "rule_title": "MFA Fatigue — Excessive Push Requests",
        "entities": ["mark.t"],
    },
    {
        "title": "Suspicious PowerShell Execution on WIN-02", "severity": "high", "status": "in_progress",
        "assignee": "argus", "tags": ["PowerShell", "T1059.001", "Obfuscation"],
        "description": "Obfuscated PowerShell attempted LSASS memory access shortly after an unusual external login.",
        "detected_at": _ago(1.2), "rule_title": "Potential Credential Dumping via LSASS Access",
        "entities": ["WIN-02", "jane.doe", "89.45.22.101"],
    },
    {
        "title": "Port-Scan Behaviour from Internal Host", "severity": "low", "status": "open",
        "assignee": None, "tags": ["discovery", "T1046"],
        "description": "Internal system connected to 80+ distinct destination ports within an hour.",
        "detected_at": _ago(0.5), "rule_title": "Systems using many different protocols",
        "entities": ["10.0.0.5"],
    },
]

_CASES: list[dict[str, Any]] = [
    {
        "code": "CASE-001", "title": "Windows DC Sync Attack", "status": "open",
        "assignee": "priya@demo.local", "tags": ["DC Sync", "Credential Theft"],
        "description": "Full investigation of DRSUAPI replication abuse from non-DC host.",
        "comments": [
            {"author": "argus", "body": "Correlated 3 detections; blast radius: WIN-DC-01, svc-backup.", "ts": _ago(2.5)},
            {"author": "priya@demo.local", "body": "Confirmed malicious. Preparing credential reset plan.", "ts": _ago(1.0)},
        ],
    },
    {
        "code": "CASE-002", "title": "O365 Impossible Travel — jane.doe", "status": "in_progress",
        "assignee": "sam@demo.local", "tags": ["O365", "Account Compromise"],
        "description": "Anomalous sign-in pair; German IP is a known VPN exit; verifying device posture.",
        "comments": [{"author": "argus", "body": "US login used a corporate device; recommending re-MFA only.", "ts": _ago(5)}],
    },
    {
        "code": "CASE-003", "title": "MFA Fatigue — mark.t", "status": "closed",
        "assignee": "priya@demo.local", "tags": ["MFA Fatigue", "Phishing"],
        "description": "Account secured, sessions revoked, credentials rotated. Closed as true positive.",
        "comments": [],
    },
]

_INTEGRATIONS: list[dict[str, Any]] = [
    {"provider": "aws", "name": "Amazon Web Services", "status": "connected", "config": {"regions": ["us-east-1"], "sources": ["CloudTrail", "GuardDuty", "SecurityHub"]}},
    {"provider": "azure", "name": "Microsoft Azure", "status": "connected", "config": {"sources": ["Defender", "Monitor"]}},
    {"provider": "gcp", "name": "Google Cloud Platform", "status": "disconnected", "config": {}},
    {"provider": "kubernetes", "name": "Kubernetes", "status": "connected", "config": {"clusters": ["prod-eu"]}},
    {"provider": "cloudflare", "name": "Cloudflare", "status": "error", "config": {"zone": "demo.example"}},
    {"provider": "docker", "name": "Docker", "status": "disconnected", "config": {}},
    {"provider": "datadog", "name": "Datadog", "status": "disconnected", "config": {}},
    {"provider": "okta", "name": "Okta", "status": "connected", "config": {"org": "demo-org"}},
    {
        "provider": "clickhouse",
        "name": "ClickHouse",
        "status": "disconnected",
        "config": {"host": "localhost", "port": 8123, "database": "aegis", "user": "default", "password": "", "agent_access": True},
    },
    {
        "provider": "opensearch",
        "name": "OpenSearch",
        "status": "disconnected",
        "config": {"url": "http://localhost:9200", "user": "admin", "password": "admin", "agent_access": True},
    },
]

_ASSETS: list[dict[str, Any]] = [
    {"kind": "host", "name": "WIN-DC-01", "criticality": "critical", "risk_score": 92, "attributes": {"os": "Windows Server 2022", "role": "Domain Controller"}},
    {"kind": "host", "name": "WIN-02", "criticality": "high", "risk_score": 81, "attributes": {"os": "Windows 11", "owner": "jane.doe"}},
    {"kind": "user", "name": "jane.doe", "criticality": "normal", "risk_score": 68, "attributes": {"dept": "Finance", "mfa": True}},
    {"kind": "user", "name": "svc-backup", "criticality": "high", "risk_score": 75, "attributes": {"type": "service-account"}},
    {"kind": "cloud", "name": "prod-eu (GKE)", "criticality": "high", "risk_score": 22, "attributes": {"provider": "gcp"}},
    {"kind": "host", "name": "10.0.0.5", "criticality": "normal", "risk_score": 35, "attributes": {"os": "Ubuntu 24.04"}},
]

_APPROVALS: list[dict[str, Any]] = [
    {"run_id": "run-8f21", "tool_name": "soar_isolate_host", "args": {"host_id": "WIN-02", "reason": "LSASS access + lateral movement indicators"}, "status": "pending"},
    {"run_id": "run-7ac3", "tool_name": "soar_disable_user", "args": {"user_id": "svc-backup", "reason": "DC Sync source account"}, "status": "pending"},
]

_POLICIES = [
    {"action_class": "notify", "mode": "auto"},
    {"action_class": "ticket", "mode": "auto"},
    {"action_class": "block_ip", "mode": "approve"},
    {"action_class": "isolate_host", "mode": "approve"},
    {"action_class": "disable_user", "mode": "approve"},
]


def seed_dev_data(tenant_id: str = DEMO_TENANT) -> None:
    """Load demo records for ``tenant_id`` (idempotent)."""
    if rules_repo.list(tenant_id):
        return
    for rule in _RULES:
        rules_repo.create(tenant_id, rule)
    for incident in _INCIDENTS:
        incidents_repo.create(tenant_id, incident)
    for case in _CASES:
        cases_repo.create(tenant_id, case)
    for integration in _INTEGRATIONS:
        integrations_repo.create(tenant_id, integration)
    for asset in _ASSETS:
        assets_repo.create(tenant_id, asset)
    for approval in _APPROVALS:
        approvals_repo.create(tenant_id, approval)
    for policy in _POLICIES:
        autonomy_repo.create(tenant_id, policy)
