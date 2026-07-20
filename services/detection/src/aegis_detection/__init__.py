"""aegis_detection — detection-as-code engine.

Rule schema (``schema``), compilers to ClickHouse SQL (``compile``), and execution /
backtest (``run``). See ``docs/06-detection-engine.md``.
"""

from __future__ import annotations

from aegis_detection.compile import CompiledRule, compile_rule
from aegis_detection.run import backtest, run_rule
from aegis_detection.schema import Rule
from aegis_detection.scheduler import run_one, run_tenant

__all__ = [
    "CompiledRule",
    "Rule",
    "backtest",
    "compile_rule",
    "run_one",
    "run_rule",
    "run_tenant",
]
