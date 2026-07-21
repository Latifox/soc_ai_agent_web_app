-- Allow arbitrary tenant ids (not just uuids) so a workspace can match its log pipeline's
-- LOGSTASH_TENANT_ID (e.g. "sekera-vps-01") and the crew queries the right t-<id>-* indices.

alter table aegis.tenants alter column id drop default;
alter table aegis.tenants alter column id type text using id::text;
alter table aegis.tenants alter column id set default gen_random_uuid()::text;
