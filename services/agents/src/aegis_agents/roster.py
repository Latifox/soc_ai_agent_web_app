"""Static crew roster — importable without agno (used by API status endpoints).

The single source of truth for who is in the Argus crew; `agents.py` builds the live
Agno agents from the same roles.
"""

from __future__ import annotations

CREW: list[dict[str, str]] = [
    {"key": "triage", "name": "Triage", "role": "Deduplicate, correlate and score incidents", "tier": "fast"},
    {"key": "investigation", "name": "Investigation", "role": "Build MITRE-mapped attack narratives", "tier": "reasoner"},
    {"key": "threat_intel", "name": "Threat Intel", "role": "IOC reputation and context", "tier": "fast"},
    {"key": "response", "name": "Response", "role": "Execute SOAR playbooks under approval policy", "tier": "balanced"},
    {"key": "detection_eng", "name": "Detection Engineering", "role": "Generate and tune detection rules", "tier": "reasoner"},
    {"key": "reporting", "name": "Reporting", "role": "Case reports and executive summaries", "tier": "balanced"},
]
