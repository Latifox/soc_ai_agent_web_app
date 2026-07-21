"""Assistant API — analyst chat with the Argus crew (SSE) + Vibe rule generation.

Backed by :class:`aegis_agents.ArgusService`: tenant context bound, memories partitioned
per tenant, session state shared with the crew. The web app's ``/api/assistant/stream``
proxy forwards here with the caller's Supabase JWT.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from aegis_core import get_logger
from aegis_core.errors import NotFoundError

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
    context: dict[str, Any] | None = None  # incident/case the analyst launched from

    def user_text(self) -> str:
        """The latest user message (supports both plain {message} and OpenAI {messages})."""
        if self.message:
            return self.message
        for msg in reversed(self.messages or []):
            if msg.role == "user":
                return msg.content if isinstance(msg.content, str) else str(msg.content)
        return ""

    def grounded_text(self) -> str:
        """The user message, prefixed with the launched incident/case context when present."""
        text = self.user_text()
        ctx = self.context or {}
        if not ctx:
            return text
        summary = ctx.get("summary") or ""
        kind = ctx.get("kind", "item")
        title = ctx.get("title", "")
        entities = ", ".join(ctx.get("entities", [])[:8])
        header = f"[Context — you are investigating {kind} '{title}'. {summary}"
        if entities:
            header += f" Entities: {entities}."
        header += "]"
        return f"{header}\n\n{text}" if text else header


class VibeRequest(BaseModel):
    prompt: str


class ConversationMessage(BaseModel):
    role: str
    content: Any = ""


class ConversationUpsert(BaseModel):
    id: str | None = None
    title: str = "New investigation"
    context: dict[str, Any] | None = None  # the incident/case the thread is about
    messages: list[ConversationMessage] = []


def _extract_rule_yaml(text: str) -> str:
    """Pull the clean rule YAML out of the agent's answer.

    The Detection-Engineering agent may narrate and echo ``rule_validate`` output; the
    editor only wants the rule. Prefer a fenced ```yaml block, then any fenced block that
    looks like a rule, then the substring from the first top-level ``title:`` onward.
    """
    fenced = re.search(r"```ya?ml\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()
    any_fence = re.search(r"```\s*(.*?)```", text, re.DOTALL)
    if any_fence and "title:" in any_fence.group(1):
        return any_fence.group(1).strip()
    match = re.search(r"^title:.*", text, re.DOTALL | re.MULTILINE)
    return match.group(0).strip() if match else text.strip()


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

    message = body.grounded_text()

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


@router.get("/conversations")
async def list_conversations(tenant: CurrentTenant) -> list[dict[str, Any]]:
    """List the tenant's saved Argus threads (newest first, without full message bodies)."""
    from apps.api.store import conversations_repo  # noqa: PLC0415

    convos = conversations_repo.list(tenant.tenant_id)
    convos.sort(key=lambda c: c.get("updated_at") or c.get("created_at") or "", reverse=True)
    return [
        {
            "id": c["id"],
            "title": c.get("title", "Investigation"),
            "context": c.get("context"),
            "message_count": len(c.get("messages", [])),
            "updated_at": c.get("updated_at") or c.get("created_at"),
        }
        for c in convos
    ]


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, tenant: CurrentTenant) -> dict[str, Any]:
    """Fetch one saved thread with its full message history."""
    from apps.api.store import conversations_repo  # noqa: PLC0415

    convo = conversations_repo.get(tenant.tenant_id, conversation_id)
    if convo is None:
        raise NotFoundError(f"conversation {conversation_id} not found")
    return convo


@router.post("/conversations")
async def upsert_conversation(body: ConversationUpsert, tenant: CurrentTenant) -> dict[str, Any]:
    """Create or update a saved Argus thread (persisted in Supabase).

    The client sends a stable ``id`` (its thread key, e.g. ``incident-<uuid>``); it's stored
    as ``thread_key`` and matched on for idempotent upserts (the DB row keeps its own uuid).
    """
    from apps.api.store import conversations_repo  # noqa: PLC0415

    data = {"title": body.title, "context": body.context, "messages": [m.model_dump() for m in body.messages], "thread_key": body.id}
    if body.id:
        existing = next((c for c in conversations_repo.list(tenant.tenant_id) if c.get("thread_key") == body.id), None)
        if existing is not None:
            return conversations_repo.update(tenant.tenant_id, existing["id"], data) or {}
    return conversations_repo.create(tenant.tenant_id, data)


@router.post("/vibe-rule")
async def vibe_rule(body: VibeRequest, tenant: CurrentTenant) -> dict[str, Any]:
    """NL -> validated detection rule YAML (Detection-Engineering agent)."""
    from aegis_agents import argus_service  # noqa: PLC0415 - heavy import

    # The Agno agent call is blocking; run it off the event loop so concurrent
    # requests don't wedge the async worker.
    run = await run_in_threadpool(argus_service.vibe_rule, tenant.tenant_id, body.prompt)
    raw = getattr(run, "content", str(run))
    return {"content": _extract_rule_yaml(raw), "raw": raw}
