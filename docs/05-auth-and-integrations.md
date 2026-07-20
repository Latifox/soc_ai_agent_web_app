# 05 — Auth, RBAC & Integrations

## Part A — Authentication & Authorization (Supabase)

### 1. Identity provider: Supabase Auth
- **Methods:** email/password, magic link, OAuth (Google/GitHub/Microsoft), **MFA (TOTP)**.
- **Enterprise:** **SAML SSO** and **SCIM** provisioning (Supabase Pro) per tenant.
- Supabase issues a signed **JWT**; the frontend keeps it in cookies via `@supabase/ssr`.

### 2. Tenant + role claims
The JWT carries custom claims (populated by a Postgres **auth hook** / custom access-token
hook on Supabase):

```json
{
  "sub": "user-uuid",
  "email": "priya@acme.com",
  "tenant_id": "acme-uuid",
  "role": "analyst",
  "permissions": ["rules:read", "incidents:write", "cases:write", "soar:approve"]
}
```
- `tenant_id` + `role` drive **Postgres RLS** ([04 §3.1](04-data-and-tenancy.md)) and API RBAC.
- Switching the active tenant re-mints the token with the new `tenant_id`.

### 3. RBAC — roles & permissions

| Role | Summary |
|------|---------|
| **Admin** | Full tenant control: users, roles, integrations, SSO/SCIM, billing, autonomy policy |
| **Manager** | SOC oversight: assign, close, reports, approve destructive actions |
| **Detection Engineer** | Author/test/enable rules; Vibe assistant |
| **Analyst** | Triage/investigate/work cases; approve if granted |
| **Read-only** | View dashboards, incidents, cases |
| **Agent (service)** | Argus crew identity; scoped tools; destructive actions gated |

- Permissions are fine-grained (`<resource>:<action>`). Checked in FastAPI deps
  (`require_permission("soar:execute")`) **and** at the data layer (RLS).
- Autonomy policy ([03 §6.2](03-agents.md)) references the **Agent** role's granted classes.

### 4. Session & verification flow
1. Browser signs in via Supabase → session cookie (`@supabase/ssr`, refreshed in
   `middleware.ts`).
2. Frontend calls the BFF with the access token; **FastAPI verifies** the JWT
   (JWKS or `SUPABASE_JWT_SECRET`), extracts claims, builds `TenantContext`.
3. Deps `require_user`, `require_tenant`, `require_permission` gate each route.
4. Backend DB sessions `SET LOCAL app.current_tenant` for service-role queries.

### 5. Non-human auth
- **Tenant-scoped API keys** (hashed, scoped permissions) for programmatic access + webhooks.
- **AgentOS** identities (JWT + RBAC + scoped service accounts) mapped to the Agent role and
  a tenant; the BFF injects `tenant_id` into every agent run.

## Part B — Integrations & Ingestion

### 6. Integrations hub (parity + superset of the teardown)
UI: stats (Total / Connected / Issues), tabs (Cloud / Security / Monitoring), connector
cards with state **Connected / Disconnected / Error** + **Configure**, and **+ Add
Integration** (see teardown §3.2). Credentials stored per-tenant in the secrets
abstraction ([INFRA-07]).

### 7. Connectors (v1)

| Category | Connectors |
|----------|-----------|
| Cloud | **AWS** (CloudTrail, GuardDuty, SecurityHub), **Azure** (Defender/Monitor), **GCP** (SCC) |
| Containers | **Kubernetes** (audit/events), **Docker** |
| Network/WAF | **Cloudflare** (WAF events) |
| Monitoring | **Datadog** |
| Identity | **Okta** (+ Azure AD) |
| Generic | **Syslog, HTTP, S3-pull, Kafka/Redpanda** |

### 8. Ingestion pipeline (Vector)
- Per-source **Vector** pipeline: collect → parse → **VRL** normalize to **ECS** → sinks:
  **ClickHouse** (hot) + local `./data` archive [+ OpenSearch for search].
- Adding a connector emits a Vector config (tenant-scoped) + stores creds; health surfaced
  on the card. High-volume tenants route through Redpanda/Kafka for buffering/replay.

### 9. Federated SIEM (detect where data lives)
- **OpenSearch** native (via `opensearch-agent-server`), plus adapters for **Splunk**,
  **Elastic**, **Microsoft Sentinel** — query external estates without ingesting.
- Federation results are normalized to ECS so rules/agents treat them uniformly.

### 10. Outbound integrations (SOAR targets) — see [06] & SOAR epic
- Notify: Slack, Teams, email, PagerDuty.
- Enforce: firewall/Cloudflare (block IP), EDR (isolate host), Okta/Azure AD/AD
  (disable/suspend user), Jira/ServiceNow (ticket).
- All destructive actions run through the autonomy policy + HITL approval.
