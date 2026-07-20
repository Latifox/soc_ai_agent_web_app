"""Detection rule schema (Pydantic) — mirrors the YAML in ``docs/06-detection-engine.md``.

Loosely typed on purpose: rules authored by hand or by the Vibe agent should validate
without every optional field. Only ``title``, ``severity`` and ``type`` are required.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high", "critical"]
RuleType = Literal[
    "query", "advanced_threshold", "source_monitor", "threat_match", "code", "spark"
]


class Threshold(BaseModel):
    """Threshold-rule aggregation spec."""

    group_by: list[str] = Field(default_factory=list)
    aggregate: str = "count()"
    operator: Literal[">", ">=", "<", "<=", "=="] = ">"
    value: float = 0


class Rule(BaseModel):
    """A detection rule."""

    model_config = {"extra": "allow"}

    title: str
    severity: Severity
    type: RuleType
    rule_id: str | None = None
    enabled: bool = True
    learning_mode: bool = False
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    mitre: list[str] = Field(default_factory=list)
    frequency: str = "15m"
    depth: str = "15m"
    indices: list[str] = Field(default_factory=list)
    query: str | None = None
    threshold: Threshold | None = None
    exclusions: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_yaml_obj(cls, data: dict[str, Any]) -> Rule:
        """Build a Rule from a parsed-YAML mapping."""
        return cls.model_validate(data)
