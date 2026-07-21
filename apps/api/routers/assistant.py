"""Assistant API — analyst chat with the Argus crew (SSE) + Vibe rule generation.

Backed by :class:`aegis_agents.ArgusService`: tenant context bound, memories partitioned
per tenant, session state shared with the crew. The web app's ``/api/assistant/stream``
proxy forwards here with the caller's Supabase JWT.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from aegis_core import get_logger

from apps.api.deps import CurrentTenant

log = get_logger(__name__)
router = APIRouter(prefix="/assistant", tags=["assistant"])


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class VibeRequest(BaseModel):
    prompt: str


@router.post("/stream")
async def assistant_stream(body: ChatRequest, tenant: CurrentTenant) -> StreamingResponse:
    """Stream the crew's reply as Server-Sent Events."""
    from aegis_agents import argus_service, iter_text  # noqa: PLC0415 - heavy import

    def sse() -> Any:
        try:
            events = argus_service.chat(
                tenant.tenant_id, body.message, session_id=body.session_id, stream=True
            )
            for chunk in iter_text(events):
                yield f"data: {chunk}\n\n"
        except Exception as exc:  # noqa: BLE001 - surface the failure to the stream
            log.error("assistant.stream.error", tenant_id=tenant.tenant_id, error=str(exc))
            yield f"event: error\ndata: {exc}\n\n"
        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream")


@router.post("/vibe-rule")
async def vibe_rule(body: VibeRequest, tenant: CurrentTenant) -> dict[str, Any]:
    """NL -> validated detection rule YAML (Detection-Engineering agent)."""
    from aegis_agents import argus_service  # noqa: PLC0415 - heavy import

    run = argus_service.vibe_rule(tenant.tenant_id, body.prompt)
    return {"content": getattr(run, "content", str(run))}
