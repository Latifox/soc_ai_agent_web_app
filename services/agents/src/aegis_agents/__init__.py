"""aegis_agents — the Argus autonomous SOC crew.

Agno agents (triage, investigation, threat-intel, response, detection-engineering,
reporting), the Argus ``Team`` supervisor, the incident-response ``Workflow``, the
governance hooks, the MCP/native tools, and the ``AgentOS`` runtime.

See ``docs/03-agents.md``.
"""

from __future__ import annotations

from aegis_agents.context import argus_run_scope, build_session_state
from aegis_agents.models import balanced, fast, reasoner
from aegis_agents.service import ArgusService, argus_service, iter_text

__all__ = [
    "ArgusService",
    "argus_run_scope",
    "argus_service",
    "balanced",
    "build_session_state",
    "fast",
    "iter_text",
    "reasoner",
]
