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


class RuleUpdate(BaseModel):
    title: str | None = None
    severity: Severity | None = None
    yaml: str | None = None
    tags: list[str] | None = None
    enabled: bool | None = None


class BacktestRequest(BaseModel):
    days: int = Field(default=30, ge=1, le=365)


class IncidentUpdate(BaseModel):
    status: IncidentStatus | None = None
    assignee: str | None = None
    severity: Severity | None = None


class CaseCreate(BaseModel):
    title: str
    description: str = ""
    incident_id: str | None = None
    tags: list[str] = Field(default_factory=list)


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
    engine: Literal["clickhouse", "opensearch"] = "clickhouse"
    query: str  # read-only SQL (clickhouse) or Lucene query_string (opensearch)
    size: int = Field(default=50, ge=1, le=500)


class FederatedSearchRequest(BaseModel):
    engine: Literal["elastic", "splunk", "sentinel"]
    query: str
    size: int = Field(default=50, ge=1, le=500)

