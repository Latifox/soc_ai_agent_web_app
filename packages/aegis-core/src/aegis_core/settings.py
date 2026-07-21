"""Application settings (pydantic-settings), read from environment / ``.env``.

Local-first defaults: ClickHouse runs as in-process ``chdb`` and object storage is
the local filesystem under ``./data`` — no S3/MinIO/ClickHouse server required. See
``docs/04-data-and-tenancy.md`` and ``.env.example`` for the full variable list.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed view over the Aegis environment.

    Field names map case-insensitively to the ``UPPER_SNAKE`` variables in
    ``.env.example``. Instantiate via :func:`get_settings` so the parse is cached.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        # ``model_*`` model names would otherwise collide with pydantic's protected
        # namespace and emit warnings.
        protected_namespaces=(),
    )

    # ── Core ────────────────────────────────────────────────────────────────
    aegis_env: Literal["dev", "staging", "prod"] = "dev"
    aegis_secret_key: str = "change-me"

    # ── Supabase (metadata Postgres + RLS + Auth) ───────────────────────────
    supabase_url: str = "http://localhost:54321"
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = "super-secret-jwt-token-with-at-least-32-characters"
    pg_url: str = "postgresql+psycopg://postgres:postgres@localhost:54322/postgres"

    # ── ClickHouse (events datalake) — local chdb by default ────────────────
    clickhouse_backend: Literal["chdb", "server"] = "chdb"
    chdb_path: str = "./data/clickhouse"
    clickhouse_host: str = "localhost"
    clickhouse_port: int = 8123
    clickhouse_user: str = "default"
    clickhouse_password: str = ""
    clickhouse_db: str = "aegis"

    # ── OpenSearch (search + federation) ────────────────────────────────────
    opensearch_url: str = "http://localhost:9200"
    opensearch_user: str = "admin"
    opensearch_password: str = "admin"
    opensearch_agent_server_url: str = "http://localhost:8001"

    # ── Redis ───────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Object store (LOCAL for now — no S3) ────────────────────────────────
    storage_backend: Literal["local", "supabase", "s3"] = "local"
    storage_local_path: str = "./data/storage"

    # ── LLM provider ────────────────────────────────────────────────────────
    # openrouter (default): one key, any model, ids like "anthropic/claude-sonnet-4.5".
    # anthropic: direct API with native Claude ids.
    llm_provider: Literal["openrouter", "anthropic"] = "openrouter"
    openrouter_api_key: str = ""
    anthropic_api_key: str = ""
    model_reasoner: str = "anthropic/claude-sonnet-4.5"
    model_balanced: str = "anthropic/claude-sonnet-4.5"
    model_fast: str = "anthropic/claude-haiku-4.5"

    # ── Threat intel ────────────────────────────────────────────────────────
    virustotal_api_key: str = ""
    abuseipdb_api_key: str = ""
    otx_api_key: str = ""
    misp_url: str = ""
    misp_api_key: str = ""

    # ── Observability ───────────────────────────────────────────────────────
    otel_service_name: str = "aegis-api"
    otel_exporter_otlp_endpoint: str = ""
    langfuse_host: str = "http://localhost:3001"
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""

    # ── AgentOS ─────────────────────────────────────────────────────────────
    agentos_url: str = "http://localhost:7777"
    agentos_security_key: str = "change-me"

    # ── API / BFF ───────────────────────────────────────────────────────────
    api_cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        """CORS origins parsed from the comma-separated ``API_CORS_ORIGINS``."""
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide :class:`Settings`, parsed once and cached."""
    return Settings()
