"""AgentOS runtime entrypoint (see ``docs/03-agents.md`` §9).

Serves the Argus team + incident-response workflow over AgentOS's FastAPI app (80+ REST
endpoints incl. runs/sessions/approvals, plus the control plane). Data stays in our own
Postgres. The BFF injects the tenant context per run; the browser never calls this
directly with secrets.

Run:  ``uvicorn services.agents.agentos_app:app --port 7777``  (or ``make agents``).
"""

from __future__ import annotations

from agno.os import AgentOS

from aegis_agents.agents import build_db
from aegis_agents.team import build_argus
from aegis_agents.workflow import build_incident_workflow


def build_agent_os() -> AgentOS:
    """Assemble the AgentOS runtime (team members are reachable via the team)."""
    db = build_db()
    argus = build_argus(db)
    workflow = build_incident_workflow(db)
    return AgentOS(id="aegis", teams=[argus], workflows=[workflow], db=db)


agent_os = build_agent_os()
app = agent_os.get_app()
