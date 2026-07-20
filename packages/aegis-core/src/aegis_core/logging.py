"""Structured logging built on ``structlog``.

``structlog`` is the intended backend and is declared as a package dependency. To
keep ``aegis_core`` importable in minimal environments (e.g. a CI job that only runs
a subset of tests), this module degrades gracefully to the stdlib :mod:`logging`
when ``structlog`` is not installed — same call sites, plain output.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

try:  # pragma: no cover - exercised indirectly depending on the environment
    import structlog

    _HAS_STRUCTLOG = True
except ModuleNotFoundError:  # pragma: no cover
    structlog = None  # type: ignore[assignment]
    _HAS_STRUCTLOG = False

_configured = False


def configure_logging(*, level: str = "INFO", json_logs: bool = False, service_name: str = "aegis") -> None:
    """Configure process-wide structured logging. Idempotent."""
    global _configured
    if _configured:
        return

    log_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=log_level)

    if _HAS_STRUCTLOG:
        renderer = structlog.processors.JSONRenderer() if json_logs else structlog.dev.ConsoleRenderer()
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                structlog.processors.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                renderer,
            ],
            wrapper_class=structlog.make_filtering_bound_logger(log_level),
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )

    _configured = True


def get_logger(name: str | None = None) -> Any:
    """Return a structured logger (``structlog`` if available, else stdlib)."""
    if _HAS_STRUCTLOG:
        return structlog.get_logger(name)
    return logging.getLogger(name or "aegis")
