# infra — dev stack, migrations, deploy

- `docker-compose.yml` — Postgres, ClickHouse, OpenSearch, Redis, MinIO, Keycloak,
  Vector, Langfuse (task **INFRA-02**).
- `alembic.ini` + `migrations/` — Postgres schema (task **INFRA-04**).
- `clickhouse_migrate.py`, `seed.py` — CH schema + seed data.
- `k8s/` / `helm/` — prod topology (task **INFRA-06**).

See [`/TODO.md`](../TODO.md) and [`docs/02-architecture.md`](../docs/02-architecture.md) §6.
