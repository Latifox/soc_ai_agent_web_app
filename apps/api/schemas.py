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
