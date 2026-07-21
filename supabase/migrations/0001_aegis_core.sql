-- Aegis core persistence — Supabase Postgres.
--
-- The metadata plane (rules, incidents, cases, assets, integrations, approvals,
-- autonomy policies, reports) is stored as tenant-scoped JSONB documents in a single
-- `aegis_records` table, plus a per-tenant `aegis_settings` document. Telemetry / logs
-- do NOT live here — they stream into OpenSearch. Tenant isolation is enforced in the
-- application layer (every query filters by tenant_id) and defended in depth by RLS.

create schema if not exists aegis;

-- ── Document store ────────────────────────────────────────────────────────────
create table if not exists aegis.records (
  tenant_id  text        not null,
  kind       text        not null,   -- rule | incident | case | asset | integration | approval | autonomy_policy | report
  id         uuid        not null default gen_random_uuid(),
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, kind, id)
);

create index if not exists records_tenant_kind_idx on aegis.records (tenant_id, kind, updated_at desc);
create index if not exists records_data_gin on aegis.records using gin (data jsonb_path_ops);

-- ── Per-tenant settings ───────────────────────────────────────────────────────
create table if not exists aegis.settings (
  tenant_id  text        primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Row-level security (defense in depth for direct Supabase access) ───────────
-- The BFF connects as a privileged role and scopes every query by tenant_id itself;
-- these policies additionally bind access to the `app.current_tenant` GUC / JWT claim
-- so anon/authenticated Supabase clients only ever see their own tenant's rows.
alter table aegis.records  enable row level security;
alter table aegis.settings enable row level security;

drop policy if exists records_tenant_isolation on aegis.records;
create policy records_tenant_isolation on aegis.records
  using (tenant_id = coalesce(current_setting('app.current_tenant', true), (auth.jwt() ->> 'tenant_id')))
  with check (tenant_id = coalesce(current_setting('app.current_tenant', true), (auth.jwt() ->> 'tenant_id')));

drop policy if exists settings_tenant_isolation on aegis.settings;
create policy settings_tenant_isolation on aegis.settings
  using (tenant_id = coalesce(current_setting('app.current_tenant', true), (auth.jwt() ->> 'tenant_id')))
  with check (tenant_id = coalesce(current_setting('app.current_tenant', true), (auth.jwt() ->> 'tenant_id')));
