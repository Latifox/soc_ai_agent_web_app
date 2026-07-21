"""aegis_detection — detection-as-code engine.

Rule schema (``schema``) and execution / backtest against OpenSearch (``run``). Rules are
Lucene (ECS field names), so there is no SQL compile step. See ``docs/06-detection-engine.md``.
"""

from __future__ import annotations

from aegis_detection.correlate import correlate, correlation_key
from aegis_detection.emit import emit_detection
from aegis_detection.persist import persist_incidents
from aegis_detection.run import backtest, run_rule
from aegis_detection.schema import Rule
from aegis_detection.scheduler import run_one, run_tenant

__all__ = [
    "Rule",
    "backtest",
    "correlate",
    "correlation_key",
    "emit_detection",
    "persist_incidents",
    "run_one",
    "run_rule",
    "run_tenant",
]
