-- Aegis events datalake (BE-06). Runs on chdb (local) and ClickHouse server (prod).
-- Tenant isolation: every table carries tenant_id; the aegis_core adapter binds/filters
-- it per query, and a ROW POLICY enforces it on the server. String columns are used for
-- ecs/raw/ips for portability across chdb builds. See docs/04-data-and-tenancy.md.

CREATE DATABASE IF NOT EXISTS aegis;

CREATE TABLE IF NOT EXISTS aegis.events (
  tenant_id      LowCardinality(String),
  event_id       UUID DEFAULT generateUUIDv4(),
  ts             DateTime64(3) DEFAULT now64(3),
  source         LowCardinality(String),
  index          LowCardinality(String),
  host_name      String,
  user_name      String,
  src_ip         String,
  dst_ip         String,
  dst_port       UInt16,
  event_category LowCardinality(String),
  event_type     LowCardinality(String),
  event_action   LowCardinality(String),
  raw            String,
  ecs            String
) ENGINE = MergeTree
ORDER BY (tenant_id, ts, source)
PARTITION BY (tenant_id, toYYYYMMDD(ts))
TTL toDateTime(ts) + INTERVAL 90 DAY;

CREATE TABLE IF NOT EXISTS aegis.detections (
  tenant_id    LowCardinality(String),
  detection_id UUID DEFAULT generateUUIDv4(),
  rule_id      String,
  ts           DateTime64(3) DEFAULT now64(3),
  severity     LowCardinality(String),
  entities     Array(String),
  event_ids    Array(UUID),
  fields       String
) ENGINE = MergeTree
ORDER BY (tenant_id, ts, rule_id)
PARTITION BY (tenant_id, toYYYYMMDD(ts));
