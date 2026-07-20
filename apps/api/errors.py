"""RFC-9457 ``application/problem+json`` error handling for the API.

Every error — Aegis domain errors, Starlette HTTP errors, request-validation errors
and otherwise-unhandled exceptions — is rendered as a problem document with
``type`` / ``title`` / ``status`` / ``detail`` / ``instance`` (plus extensions).
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from aegis_core.errors import AegisError

PROBLEM_CONTENT_TYPE = "application/problem+json"


class Problem(BaseModel):
    """RFC-9457 problem document (used for OpenAPI documentation)."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None


def _status_phrase(status: int) -> str:
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return "Error"


def _problem(status: int, body: dict[str, Any]) -> JSONResponse:
    return JSONResponse(status_code=status, content=body, media_type=PROBLEM_CONTENT_TYPE)


async def aegis_error_handler(request: Request, exc: AegisError) -> JSONResponse:
    body: dict[str, Any] = {
        "type": f"/problems/{exc.code}",
        "title": exc.title,
        "status": exc.http_status,
        "detail": exc.detail,
        "instance": str(request.url),
        **exc.extra,
    }
    return _problem(exc.http_status, body)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    body: dict[str, Any] = {
        "type": "about:blank",
        "title": _status_phrase(exc.status_code),
        "status": exc.status_code,
        "detail": exc.detail if isinstance(exc.detail, str) else None,
        "instance": str(request.url),
    }
    return _problem(exc.status_code, body)


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": "/problems/validation_error",
        "title": "Unprocessable Entity",
        "status": HTTPStatus.UNPROCESSABLE_ENTITY,
        "detail": "Request validation failed",
        "instance": str(request.url),
        "errors": jsonable_encoder(exc.errors()),
    }
    return _problem(HTTPStatus.UNPROCESSABLE_ENTITY, body)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    body: dict[str, Any] = {
        "type": "/problems/internal_error",
        "title": "Internal Server Error",
        "status": HTTPStatus.INTERNAL_SERVER_ERROR,
        "detail": "An unexpected error occurred",
        "instance": str(request.url),
    }
    return _problem(HTTPStatus.INTERNAL_SERVER_ERROR, body)


def register_exception_handlers(app: FastAPI) -> None:
    """Wire the problem+json handlers onto ``app``."""
    app.add_exception_handler(AegisError, aegis_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_exception_handler)
