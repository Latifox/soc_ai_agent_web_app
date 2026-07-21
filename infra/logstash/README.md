# Logstash collector — local + VPS deployment

Catches logs (Beats :5044, syslog :5514 tcp/udp), tags them with the tenant, and ships
to **OpenSearch** (`t-{tenant}-logs-*`) and **ClickHouse** (`aegis.events`). The same
pipeline runs in the dev compose and standalone on a VPS close to the log sources.

## Local (dev compose)

```bash
docker compose -f infra/docker-compose.yml up -d logstash
# test a syslog line:
echo '<134>Jul 21 03:00:00 fw01 test: hello from syslog' | nc -u localhost 5514
```

## VPS deployment (systemd + Docker)

1. Provision a VPS reachable by your log sources; open **5044/tcp** (Beats) and
   **5514/tcp+udp** (syslog) from those sources only (firewall/security-group).
2. Install Docker, then:

```bash
mkdir -p /opt/aegis-logstash/pipeline
scp infra/logstash/pipeline/aegis.conf vps:/opt/aegis-logstash/pipeline/

docker run -d --name aegis-logstash --restart unless-stopped \
  -p 5044:5044 -p 5514:5514 -p 5514:5514/udp \
  -e LOGSTASH_TENANT_ID="<your-tenant-uuid>" \
  -e OPENSEARCH_URL="https://<your-opensearch-host>:9200" \
  -e CLICKHOUSE_URL="https://<your-clickhouse-host>:8123" \
  -e LS_JAVA_OPTS="-Xms512m -Xmx512m" \
  -v /opt/aegis-logstash/pipeline:/usr/share/logstash/pipeline:ro \
  opensearchproject/logstash-oss-with-opensearch-output-plugin:8.9.0
```

3. Point sources at it:
   - **Filebeat/Winlogbeat:** `output.logstash: hosts: ["<vps-ip>:5044"]`
   - **Syslog devices (firewalls, appliances):** target `<vps-ip>:5514` (UDP or TCP).
4. TLS in production: front 5044/5514 with your certs (Logstash `ssl => true` on the
   beats input) and use HTTPS endpoints for OpenSearch/ClickHouse with credentials.

## Web UIs

- **OpenSearch Dashboards:** http://localhost:5601 (dev compose) — create the index
  pattern `t-*-logs-*` to explore shipped logs.
- **ClickHouse Play:** http://localhost:8123/play — run SQL over `aegis.events`.
