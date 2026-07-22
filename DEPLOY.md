# Deploying Aegis (Railway)

Aegis is **Docker-free**. It deploys as **three services** from this one repo, all sharing the
**same env vars** (see [`.env.example`](.env.example)). The data plane is remote/managed:

- **OpenSearch** — managed/self-hosted cluster (set `OPENSEARCH_URL`). Not deployed here.
- **Supabase** — hosted project for Auth + metadata Postgres. Not deployed here.

## The three services

| Service | Railway *Root Directory* | Railway *Config Path* | Public? |
|---------|--------------------------|------------------------|---------|
| **web** (Next.js console) | `apps/web` | `railway.json` (auto) | yes |
| **api** (FastAPI BFF) | `/` (repo root) | `railway.api.json` | yes |
| **agents** (AgentOS crew) | `/` (repo root) | `railway.agents.json` | internal |

Each service’s start command binds `0.0.0.0:$PORT` (Railway injects `PORT`). The config files
in this repo set the build + start commands; you only set the Root Directory and Config Path in
each Railway service’s settings, plus the env vars below.

Create the three services pointing at the same GitHub repo:

1. **web** → Settings → Root Directory = `apps/web`. (Railway auto-reads `apps/web/railway.json`.)
2. **api** → Settings → Root Directory = `/`, Config-as-code path = `railway.api.json`.
3. **agents** → Settings → Root Directory = `/`, Config-as-code path = `railway.agents.json`.

## Build failed immediately (~4s) at the repo root?

That means the service is trying to build the **whole monorepo** (both Node and Python are
present at the root, so the auto-builder can't decide). Fix = point each service at its subtree:

- This service is the **web** app → Settings → **Root Directory = `apps/web`**, then Deploy.
  It picks up `apps/web/railway.json` (Node build, `npm run build` / `npm run start`).
- For the **api/agents**, set Root Directory `/` and **Config Path** to `railway.api.json`
  / `railway.agents.json`. Those force `builder: DOCKERFILE` against the root `Dockerfile`
  (Python + `uv sync`), so Railway can't auto-detect the Node app and build the wrong thing.

One Railway service = one subtree. Don't deploy the bare repo root with default settings.

## Minimal deploy (Railway $5 trial): web + api only

The **agents** service is optional. The interactive Argus assistant runs *in-process inside the
api* service, so **web + api** gives you the full console — sign in/up, onboarding, dashboards,
assets from OpenSearch, and the AI assistant (incl. per-tenant OpenRouter). Deploying only two
services roughly halves the always-on cost.

What you give up without the agents service: the autonomous background crew/workflow and
auto-**resuming** a paused destructive action after approval (the approval is still recorded;
`resume_run` just no-ops and logs a warning). Add the agents service later when you have budget —
set `AGENTOS_URL` on the api service to its URL at that point.

To keep trial cost down: give each service the smallest instance, and enable **App Sleeping**
(Settings → Serverless) so idle services scale to zero. Supabase and OpenSearch live outside
Railway (free tiers / your own cluster), so they don't consume trial credit.

## Environment variables

Set the **same** values across services (Railway shared variables help). Service-specific notes:

- **All:** `AEGIS_ENV=prod`, `AEGIS_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `PG_URL`,
  `PERSISTENCE=postgres`, `SEED_DEMO=false`.
- **web:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `AEGIS_API_URL=https://<api-service>.up.railway.app`.
- **api:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENSEARCH_URL/USER/PASSWORD`,
  `AGENTOS_URL=https://<agents-service>.up.railway.app`, `AGENTOS_SECURITY_KEY`.
- **agents:** `OPENSEARCH_URL/USER/PASSWORD`, `LLM_PROVIDER=openrouter`, `OPENROUTER_API_KEY`
  (a global fallback — tenants can also supply their own key from the web Integrations page),
  `MODEL_*`, `AGENTOS_SECURITY_KEY`.

Wire them together with the public URLs: **web → api** via `AEGIS_API_URL`, **api → agents** via
`AGENTOS_URL`.

## Paste-ready env (Railway → Variables → Raw Editor)

Fill the `<...>` placeholders, then paste each block into that service’s Raw Editor.

**web** service:

```
AEGIS_ENV=prod
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
AEGIS_API_URL=https://<api-service>.up.railway.app
```

**api** service (also runs the in-process AI assistant):

```
AEGIS_ENV=prod
AEGIS_SECRET_KEY=<random-32+>
PERSISTENCE=postgres
SEED_DEMO=false
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret>
PG_URL=postgresql://postgres:<db-password>@db.<project>.supabase.co:5432/postgres
OPENSEARCH_URL=https://<cluster-host>:<port>
OPENSEARCH_USER=<os-user>
OPENSEARCH_PASSWORD=<os-password>
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=<openrouter-key>
MODEL_REASONER=anthropic/claude-sonnet-4.5
MODEL_BALANCED=anthropic/claude-sonnet-4.5
MODEL_FAST=anthropic/claude-haiku-4.5
MODEL_ASSISTANT=anthropic/claude-sonnet-4.5
AGENTOS_SECURITY_KEY=<random-32+>
```

**agents** service (optional — add when you have budget). Same as **api** plus nothing extra;
then set `AGENTOS_URL` on the **api** service to the agents service URL.

## Publish as a reusable Railway template (optional)

After the two services are live: Railway project → **Settings → Publish as Template**. Railway
generates a shareable one-click link and a **Deploy on Railway** button you can drop into the
README — it recreates both services + prompts for these same variables.

## Supabase setup

1. Create a project; copy `SUPABASE_URL`, anon key, service-role key, JWT secret, and the direct
   `PG_URL` into the env.
2. Apply the schema in `supabase/migrations/`.
3. Enable Email auth (password + magic link). New users sign up in the web console, then run
   onboarding to create their tenant + connect OpenSearch.

## OpenSearch

Point `OPENSEARCH_URL` at your managed cluster. Provision the events index template once with
`python infra/opensearch_setup.py` (or let onboarding provision it per tenant). Ship logs with
`infra/logstash/pipeline/aegis.conf` from the box that produces them.

## Local dev

Copy `.env.example` → `.env` at the repo root (shared by all three), then:

```
make api      # FastAPI on :8000
make agents   # AgentOS on :7777
make web      # Next.js on :3000
```
