"""Assistant API — analyst chat with the Argus crew (SSE) + Vibe rule generation.

Backed by :class:`aegis_agents.ArgusService`: tenant context bound, memories partitioned
per tenant, session state shared with the crew. The web app's ``/api/assistant/stream``
proxy forwards here with the caller's Supabase JWT.
"""

from __future__ import annotations

import json
import time
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from aegis_core import get_logger

from apps.api.deps import CurrentTenant

log = get_logger(__name__)
router = APIRouter(prefix="/assistant", tags=["assistant"])


class ChatMessage(BaseModel):
    role: str = "user"
    content: Any = ""


class ChatRequest(BaseModel):
    message: str | None = None
    messages: list[ChatMessage] | None = None
    session_id: str | None = None

    def user_text(self) -> str:
        """The latest user message (supports both plain {message} and OpenAI {messages})."""
        if self.message:
            return self.message
        for msg in reversed(self.messages or []):
            if msg.role == "user":
                return msg.content if isinstance(msg.content, str) else str(msg.content)
        return ""


class VibeRequest(BaseModel):
    prompt: str


def _chunk(content: str, *, role: str | None = None) -> str:
    """One OpenAI-style chat.completion.chunk SSE frame (consumed by OpenUI's adapter)."""
    delta: dict[str, Any] = {"content": content}
    if role:
        delta = {"role": role, "content": content}
    payload = {
        "id": "argus",
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": "argus",
        "choices": [{"index": 0, "delta": delta, "finish_reason": None}],
    }
    return f"data: {json.dumps(payload)}\n\n"


@router.post("/stream")
async def assistant_stream(body: ChatRequest, tenant: CurrentTenant) -> StreamingResponse:
    """Stream the crew's reply as OpenAI-compatible Server-Sent Events."""
    from aegis_agents import argus_service, iter_text  # noqa: PLC0415 - heavy import

    message = body.user_text()

    def sse() -> Any:
        first = True
        got_output = False
        try:
            events = argus_service.chat(
                tenant.tenant_id, message, session_id=body.session_id, stream=True
            )
            for text in iter_text(events):
                got_output = True
                yield _chunk(text, role="assistant" if first else None)
                first = False
        except Exception as exc:  # noqa: BLE001 - surface the failure to the client
            log.error("assistant.stream.error", tenant_id=tenant.tenant_id, error=str(exc))
            yield _chunk(f"⚠️ Assistant error: {exc}", role="assistant")
            got_output = True
        if not got_output:
            yield _chunk("No response generated.", role="assistant")
        # Terminal chunk — the OpenAI adapter commits the message on finish_reason=stop.
        stop = {
            "id": "argus",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": "argus",
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        }
        yield f"data: {json.dumps(stop)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream")


@router.post("/vibe-rule")
async def vibe_rule(body: VibeRequest, tenant: CurrentTenant) -> dict[str, Any]:
    """NL -> validated detection rule YAML (Detection-Engineering agent)."""
    from aegis_agents import argus_service  # noqa: PLC0415 - heavy import

    run = argus_service.vibe_rule(tenant.tenant_id, body.prompt)
    return {"content": getattr(run, "content", str(run))}
