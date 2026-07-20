"""Apply infra/clickhouse/schema.sql to the configured backend (chdb or server).

Run: ``python infra/clickhouse_migrate.py`` (or ``make migrate``). Respects
``CLICKHOUSE_BACKEND`` — chdb (local, file-backed) by default, server in prod.
"""

from __future__ import annotations

from pathlib import Path

from aegis_core import get_logger, get_settings

log = get_logger(__name__)
_SCHEMA = Path(__file__).parent / "clickhouse" / "schema.sql"


def _statements(sql: str) -> list[str]:
    out: list[str] = []
    for chunk in sql.split(";"):
        lines = [ln for ln in chunk.splitlines() if not ln.strip().startswith("--")]
        stmt = "\n".join(lines).strip()
        if stmt:
            out.append(stmt)
    return out


def main() -> None:
    settings = get_settings()
    statements = _statements(_SCHEMA.read_text(encoding="utf-8"))
    if settings.clickhouse_backend == "chdb":
        from chdb import session as chs

        Path(settings.chdb_path).mkdir(parents=True, exist_ok=True)
        session = chs.Session(settings.chdb_path)
        for stmt in statements:
            session.query(stmt)
        session.close()
    else:
        import clickhouse_connect

        client = clickhouse_connect.get_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_port,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
        )
        for stmt in statements:
            client.command(stmt)
    log.info("clickhouse.migrate.done", backend=settings.clickhouse_backend, statements=len(statements))


if __name__ == "__main__":
    main()
