"""Thin client for resuming paused AgentOS runs from an approval decision.

When a destructive tool pauses an Argus run (``requires_confirmation``), the analyst's
approve/deny here resolves the requirement via AgentOS's continue/approvals endpoint.
Best-effort: network failures are logged, not raised, so the approval is still recorded.
"""

from __future__ import annotations

from typing import Any

from aegis_core import get_logger, get_settings

log = get_logger(__name__)


def resume_run(*, run_id: str, tool_name: str, approved: bool) -> dict[str, Any]:
    """Tell AgentOS to continue ``run_id`` with the requirement confirmed or rejected."""
    settings = get_settings()
    payload = {"run_id": run_id, "tool_name": tool_name, "confirmed": approved}
    try:
        import httpx  # noqa: PLC0415

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{settings.agentos_url.rstrip('/')}/runs/{run_id}/continue",
                json=payload,
                headers={"authorization": f"Bearer {settings.agentos_security_key}"},
            )
            resp.raise_for_status()
            return {"resumed": True, "status": resp.status_code}
    except Exception as exc:  # noqa: BLE001 - resume is best-effort; approval already recorded
        log.warning("agentos.resume.failed", run_id=run_id, error=str(exc))
        return {"resumed": False, "error": str(exc)}
