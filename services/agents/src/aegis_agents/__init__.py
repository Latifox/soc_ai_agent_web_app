"""aegis_agents — the Argus autonomous SOC crew.

Agno agents (triage, investigation, threat-intel, response, detection-engineering,
reporting), the Argus ``Team`` supervisor, the incident-response ``Workflow``, the
governance hooks, the MCP/native tools, and the ``AgentOS`` runtime.

See ``docs/03-agents.md``.
"""

from __future__ import annotations

from aegis_agents.models import balanced, fast, reasoner

__all__ = ["balanced", "fast", "reasoner"]
