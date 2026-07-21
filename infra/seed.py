"""Seed the ClickHouse events datalake with demo data (``make seed``).

Inserts events for tenant ``demo-tenant`` that trip the "many different protocols"
threshold rule (>50 distinct destination ports from one source in an hour), so a
backtest returns hits out of the box. Respects ``CLICKHOUSE_BACKEND``.
"""

from __future__ import annotations

from pathlib import Path

from aegis_core import get_logger, get_settings

log = get_logger(__name__)

# Matches the demo tenant uuid seeded into Supabase (infra/supabase/seed.sql).
_TENANT = "11111111-1111-1111-1111-111111111111"


def _values() -> str:
    rows = []
    for port in range(1000, 1080):  # 80 distinct ports -> trips the >50 threshold
        rows.append(
            "('%s', now() - INTERVAL %d MINUTE, 'fortinet', 'syslog-fortinet-fw', "
            "'WIN-02', 'jane.doe', '10.0.0.5', '8.8.8.8', %d, 'network', 'allowed', "
            "'accept', '', '{}')" % (_TENANT, port % 50, port)
        )
    return ",\n".join(rows)


_INSERT = (
    "INSERT INTO aegis.events "
    "(tenant_id, ts, source, `index`, host_name, user_name, src_ip, dst_ip, dst_port, "
    "event_category, event_type, event_action, raw, ecs) VALUES\n" + _values()
)


def main() -> None:
    settings = get_settings()
    if settings.clickhouse_backend == "chdb":
        from chdb import session as chs

        Path(settings.chdb_path).mkdir(parents=True, exist_ok=True)
        session = chs.Session(settings.chdb_path)
        session.query(_INSERT)
        session.close()
    else:
        import clickhouse_connect

        client = clickhouse_connect.get_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_port,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
        )
        client.command(_INSERT)
    log.info("clickhouse.seed.done", tenant=_TENANT, backend=settings.clickhouse_backend)


if __name__ == "__main__":
    main()
