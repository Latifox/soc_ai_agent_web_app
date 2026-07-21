"""Request/response models for the v1 API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high", "critical"]
RuleType = Literal["query", "advanced_threshold", "source_monitor", "threat_match", "code", "spark"]
CaseStatus = Literal["open", "in_progress", "closed"]
IncidentStatus = Literal["open", "in_progress", "resolved"]


class RuleCreate(BaseModel):
    title: str
    severity: Severity = "medium"
    type: RuleType = "query"
    yaml: str
    tags: list[str] = Field(default_factory=list)
    enabled: bool = True
    integration: str | None = None


class RuleUpdate(BaseModel):
    title: str | None = None
    severity: Severity | None = None
    yaml: str | None = None
    tags: list[str] | None = None
    enabled: bool | None = None
    integration: str | None = None


class BacktestRequest(BaseModel):
    days: int = Field(default=30, ge=1, le=365)


class RuleApplyRequest(BaseModel):
    integration: str  # provider key of a connected integration (e.g. "fortinet", "opensearch")

    def provider_is_opensearch(self) -> bool:
        return self.integration.lower() == "opensearch"


class IncidentUpdate(BaseModel):
    status: IncidentStatus | None = None
    assignee: str | None = None
    severity: Severity | None = None


class CaseCreate(BaseModel):
    title: str
    description: str = ""
    incident_id: str | None = None
    tags: list[str] = Field(default_factory=list)


class PreferencesUpdate(BaseModel):
    incident_notifications: bool | None = None
    daily_digest: bool | None = None
    weekly_report: bool | None = None


class DetectionConfigUpdate(BaseModel):
    default_severity: Severity | None = None
    schedule_frequency: str | None = None
    retention_days: int | None = Field(default=None, ge=1, le=3650)
    auto_close_fp: bool | None = None


class SettingsUpdate(BaseModel):
    org_name: str | None = None
    timezone: str | None = None
    contact_email: str | None = None
    preferences: PreferencesUpdate | None = None
    detection: DetectionConfigUpdate | None = None

    def to_patch(self) -> dict[str, object]:
        """Drop unset fields at every level so a PUT only changes what was sent."""
        def prune(d: dict[str, object]) -> dict[str, object]:
            out: dict[str, object] = {}
            for k, v in d.items():
                if v is None:
                    continue
                out[k] = prune(v) if isinstance(v, dict) else v
            return out

        return prune(self.model_dump())


class CaseUpdate(BaseModel):
    status: CaseStatus | None = None
    assignee: str | None = None
    title: str | None = None
    description: str | None = None


class CommentCreate(BaseModel):
    body: str


class IntegrationCreate(BaseModel):
    provider: str
    name: str
    config: dict[str, object] = Field(default_factory=dict)


class IntegrationUpdate(BaseModel):
    name: str | None = None
    status: Literal["connected", "disconnected", "error"] | None = None
    config: dict[str, object] | None = None


class AssetCreate(BaseModel):
    kind: Literal["host", "user", "cloud", "identity"]
    name: str
    criticality: Literal["low", "normal", "high", "critical"] = "normal"
    attributes: dict[str, object] = Field(default_factory=dict)


ActionClass = Literal["notify", "ticket", "block_ip", "isolate_host", "disable_user"]
AutonomyMode = Literal["auto", "approve", "deny"]


class AutonomyPolicyUpsert(BaseModel):
    action_class: ActionClass
    mode: AutonomyMode


class ApprovalDecision(BaseModel):
    decision: Literal["approve", "deny"]


class SearchRequest(BaseModel):
    engine: Literal["opensearch"] = "opensearch"
    query: str  # Lucene query_string over the tenant's OpenSearch indices
    size: int = Field(default=50, ge=1, le=500)


class FederatedSearchRequest(BaseModel):
    engine: Literal["elastic", "splunk", "sentinel"]
    query: str
    size: int = Field(default=50, ge=1, le=500)

