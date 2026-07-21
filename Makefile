.PHONY: up down logs migrate seed api web agents lint test fmt

up:            ## start dev stack
	docker compose -f infra/docker-compose.yml up -d

down:
	docker compose -f infra/docker-compose.yml down

logs:
	docker compose -f infra/docker-compose.yml logs -f

migrate:       ## run ClickHouse migrations (Postgres schema is applied by Supabase)
	uv run python infra/clickhouse_migrate.py

seed:          ## seed ClickHouse events + OpenSearch demo docs/template
	uv run python infra/seed.py
	uv run python infra/opensearch_setup.py

datastack-up:  ## start ClickHouse, OpenSearch, Dashboards, Logstash
	docker compose -f infra/docker-compose.yml up -d clickhouse opensearch opensearch-dashboards logstash

api:
	uv run uvicorn apps.api.main:app --reload --port 8000

agents:        ## AgentOS runtime
	uv run uvicorn services.agents.agentos_app:app --reload --port 7777

web:
	pnpm --filter @aegis/web dev

lint:
	uv run ruff check . && pnpm -r lint

test:
	uv run pytest && pnpm -r test

fmt:
	uv run ruff format . && pnpm -r format
