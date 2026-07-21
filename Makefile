.PHONY: api web agents lint test fmt

# Aegis runs three long-lived processes. No Docker: OpenSearch is a remote/managed cluster
# (set OPENSEARCH_URL), app metadata + auth are Supabase (cloud). Deploy each process as its
# own Railway service — see DEPLOY.md.

api:           ## FastAPI BFF (http://localhost:8000)
	uv run uvicorn apps.api.main:app --reload --port 8000

agents:        ## AgentOS runtime (http://localhost:7777)
	uv run uvicorn services.agents.agentos_app:app --reload --port 7777

web:           ## Next.js console (http://localhost:3000)
	pnpm --filter @aegis/web dev

lint:
	uv run ruff check . && pnpm -r lint

test:
	uv run pytest && pnpm -r test

fmt:
	uv run ruff format . && pnpm -r format
