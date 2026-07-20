"""Aegis API / BFF — FastAPI application.

Run with ``uvicorn apps.api.main:app --reload --port 8000`` (or ``make api``).
Wires health probes, CORS, RFC-9457 problem+json error handling, OpenAPI metadata
and the ``/api/v1`` router.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from aegis_core import configure_logging, configure_tracing, get_logger, get_settings
from apps.api.errors import register_exception_handlers
from apps.api.routers.v1 import router as v1_router

log = get_logger(__name__)

_DESCRIPTION = (
    "Aegis — AI-Native Open XDR & Autonomous SOC Platform. "
    "API / BFF: auth, tenant context, and the versioned REST surface."
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(service_name=settings.otel_service_name, json_logs=settings.aegis_env != "dev")
    configure_tracing(
        service_name=settings.otel_service_name,
        otlp_endpoint=settings.otel_exporter_otlp_endpoint or None,
    )
    log.info("aegis-api.startup", env=settings.aegis_env)
    yield
    log.info("aegis-api.shutdown")


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()
    app = FastAPI(
        title="Aegis API",
        version="0.1.0",
        description=_DESCRIPTION,
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    @app.get("/healthz", tags=["health"])
    async def healthz() -> dict[str, str]:
        """Liveness probe."""
        return {"status": "ok"}

    @app.get("/readyz", tags=["health"])
    async def readyz() -> dict[str, str]:
        """Readiness probe (dependency checks land with the data-plane tasks)."""
        return {"status": "ready"}

    app.include_router(v1_router, prefix="/api/v1")
    return app


app = create_app()
