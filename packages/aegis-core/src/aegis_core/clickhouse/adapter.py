"""ClickHouse backends and the tenant-scoping query builder.

The public contract is :func:`get_clickhouse` (selects a backend from
:class:`~aegis_core.settings.Settings`) returning something that satisfies
:class:`ClickHouseBackend`. Both concrete backends import their driver lazily, so
constructing an adapter never requires ``chdb`` or ``clickhouse-connect`` to be
installed — only running an actual query does.
"""

from __future__ import annotations

import re
from typing import Any, Protocol, runtime_checkable

from aegis_core.errors import ConfigurationError, TenantIsolationError
from aegis_core.settings import Settings

Params = dict[str, Any]
Row = dict[str, Any]

_TENANT_RE = re.compile(r"^[A-Za-z0-9_.:-]+$")
_PARAM_RE = re.compile(r"\{(\w+):[A-Za-z0-9_()]+\}")


def build_tenant_scoped_query(
    sql: str, params: Params | None, tenant_id: str
) -> tuple[str, Params]:
    """Wrap ``sql`` so its rows are constrained to ``tenant_id``.

    Returns ``(scoped_sql, params)`` where ``scoped_sql`` selects from the caller's
    query as a subquery and filters on ``tenant_id`` via a bound ``aegis_tenant``
    parameter (ClickHouse ``{name:Type}`` syntax — never string interpolation of
    tenant data). Raises :class:`TenantIsolationError` when ``tenant_id`` is absent.
    """
    if not tenant_id or not tenant_id.strip():
        raise TenantIsolationError("tenant_id is required for every ClickHouse query")

    merged: Params = dict(params or {})
    merged["aegis_tenant"] = tenant_id
    inner = sql.strip().rstrip(";")
    # Tenant value is bound via {aegis_tenant:String}, never interpolated.
    scoped_sql = (
        f"SELECT * FROM (\n{inner}\n) AS _aegis_scoped\n"
        "WHERE tenant_id = {aegis_tenant:String}"  # noqa: S608
    )
    return scoped_sql, merged


@runtime_checkable
class ClickHouseBackend(Protocol):
    """A tenant-scoped ClickHouse query surface."""

    backend: str

    def query(self, sql: str, params: Params | None = None, *, tenant_id: str) -> list[Row]:
        """Run ``sql`` (auto tenant-scoped) and return rows as dicts."""
        ...


def _chdb_literal(value: Any) -> str:
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int | float):
        return str(value)
    text = str(value).replace("\\", "\\\\").replace("'", "''")
    return f"'{text}'"


def _render_chdb_params(sql: str, params: Params) -> str:
    """Substitute ``{name:Type}`` placeholders with safely-quoted literals.

    ``chdb`` sessions do not expose server-side parameter binding, so the tenant
    value (already validated against a strict allowlist) is rendered as an escaped
    literal. Non-tenant params are the caller's responsibility.
    """

    def repl(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in params:
            raise ConfigurationError(f"missing bind parameter {name!r} for chdb query")
        if name == "aegis_tenant" and not _TENANT_RE.match(str(params[name])):
            raise TenantIsolationError(f"invalid tenant_id: {params[name]!r}")
        return _chdb_literal(params[name])

    return _PARAM_RE.sub(repl, sql)


class ChdbClickHouse:
    """In-process ClickHouse backend using ``chdb`` (local dev, no server)."""

    backend = "chdb"

    def __init__(self, path: str, database: str = "aegis") -> None:
        self._path = path
        self._database = database
        self._session: Any = None

    def _get_session(self) -> Any:
        if self._session is None:
            from pathlib import Path  # noqa: PLC0415

            from chdb import session as chs  # noqa: PLC0415 - optional local backend

            Path(self._path).mkdir(parents=True, exist_ok=True)
            self._session = chs.Session(self._path)
        return self._session

    def query(self, sql: str, params: Params | None = None, *, tenant_id: str) -> list[Row]:
        scoped_sql, merged = build_tenant_scoped_query(sql, params, tenant_id)
        rendered = _render_chdb_params(scoped_sql, merged)
        import json  # noqa: PLC0415

        result = self._get_session().query(rendered, "JSONEachRow")
        text = str(result).strip()
        return [json.loads(line) for line in text.splitlines() if line.strip()]

    def close(self) -> None:
        if self._session is not None:
            self._session.close()
            self._session = None


class ServerClickHouse:
    """ClickHouse server backend via ``clickhouse-connect`` (staging/prod)."""

    backend = "server"

    def __init__(
        self,
        host: str,
        port: int,
        user: str,
        password: str,
        database: str,
    ) -> None:
        self._host = host
        self._port = port
        self._user = user
        self._password = password
        self._database = database
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            import clickhouse_connect  # noqa: PLC0415 - optional server backend

            self._client = clickhouse_connect.get_client(
                host=self._host,
                port=self._port,
                username=self._user,
                password=self._password,
                database=self._database,
            )
        return self._client

    def query(self, sql: str, params: Params | None = None, *, tenant_id: str) -> list[Row]:
        scoped_sql, merged = build_tenant_scoped_query(sql, params, tenant_id)
        result = self._get_client().query(scoped_sql, parameters=merged)
        return [dict(row) for row in result.named_results()]

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None


def get_clickhouse(settings: Settings) -> ClickHouseBackend:
    """Return the ClickHouse backend selected by ``CLICKHOUSE_BACKEND``."""
    if settings.clickhouse_backend == "chdb":
        return ChdbClickHouse(path=settings.chdb_path, database=settings.clickhouse_db)
    if settings.clickhouse_backend == "server":
        return ServerClickHouse(
            host=settings.clickhouse_host,
            port=settings.clickhouse_port,
            user=settings.clickhouse_user,
            password=settings.clickhouse_password,
            database=settings.clickhouse_db,
        )
    raise ConfigurationError(f"unknown CLICKHOUSE_BACKEND: {settings.clickhouse_backend!r}")
