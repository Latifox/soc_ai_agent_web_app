"""OpenTelemetry tracing setup.

Offline-safe by default: with no OTLP endpoint configured, a ``TracerProvider`` is
installed with no exporters so instrumentation is cheap and never touches the
network. Point ``OTEL_EXPORTER_OTLP_ENDPOINT`` at a collector to ship spans.
"""

from __future__ import annotations

from typing import Any

try:  # pragma: no cover - depends on the environment
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    _HAS_OTEL = True
except ModuleNotFoundError:  # pragma: no cover
    _HAS_OTEL = False

_configured = False


def configure_tracing(*, service_name: str = "aegis", otlp_endpoint: str | None = None) -> None:
    """Install a global :class:`TracerProvider`. Idempotent and offline-safe."""
    global _configured
    if _configured or not _HAS_OTEL:
        return

    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)

    if otlp_endpoint:
        # Only import/attach the OTLP exporter when an endpoint is configured so the
        # exporter package stays an optional dependency.
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (  # noqa: PLC0415
            OTLPSpanExporter,
        )

        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint)))

    trace.set_tracer_provider(provider)
    _configured = True


def get_tracer(name: str) -> Any:
    """Return a tracer for ``name`` (a no-op tracer if OTel is unavailable)."""
    if not _HAS_OTEL:
        return _NoopTracer()
    return trace.get_tracer(name)


class _NoopTracer:
    """Minimal stand-in used when OpenTelemetry is not installed."""

    def start_as_current_span(self, name: str, **_: Any) -> Any:  # pragma: no cover
        from contextlib import nullcontext  # noqa: PLC0415

        return nullcontext()
