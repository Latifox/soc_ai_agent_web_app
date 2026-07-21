-- Aegis tenants — the onboarding registry.
--
-- Each row is an organization/workspace. Onboarding creates a tenant here, then stores its
-- external OpenSearch connection as an `integration` record under the new tenant_id (in
-- aegis.records) so the Argus crew can query that tenant's logs. RLS is intentionally NOT
-- enabled on this table: it is the cross-tenant directory the control plane reads to list
-- and switch workspaces (the BFF still gates writes behind an admin permission).

create table if not exists aegis.tenants (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  status      text        not null default 'active',
  opensearch_url text,
  created_at  timestamptz not null default now()
);

create index if not exists tenants_created_idx on aegis.tenants (created_at desc);
