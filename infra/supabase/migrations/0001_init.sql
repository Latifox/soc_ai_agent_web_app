-- Aegis metadata schema + Row-Level Security (BE-02).
-- Tenant isolation: every table carries tenant_id and an RLS policy that matches it to
-- the active tenant. The active tenant comes from either the Supabase JWT
-- (request.jwt.claims -> tenant_id) or, for trusted service connections, the
-- app.current_tenant GUC set by the BFF. See docs/04-data-and-tenancy.md.

create extension if not exists pgcrypto;
create schema if not exists app;

-- Resolve the active tenant for RLS (JWT claim, or service GUC fallback).
create or replace function app.current_tenant() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('app.current_tenant', true), ''),
    nullif(current_setting('request.jwt.claims', true)::json ->> 'tenant_id', '')
  )::uuid
$$;

-- ── Core tenancy ────────────────────────────────────────────────────────────
create table tenants (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text unique not null,
  plan           text not null default 'free',
  retention_days int  not null default 90,
  created_at     timestamptz not null default now()
);

create table users (
  id         uuid primary key,                       -- mirrors auth.users.id
  email      text not null,
  name       text,
  created_at timestamptz not null default now()
);

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null default 'analyst',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  permissions jsonb not null default '[]',
  unique (tenant_id, name)
);

create table api_keys (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  name       text not null,
  hash       text not null,
  scopes     jsonb not null default '[]',
  last_used  timestamptz,
  created_at timestamptz not null default now()
);

create table audit_log (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  actor      text not null,
  actor_type text not null default 'user',           -- user | agent | system
  action     text not null,
  target     text,
  meta       jsonb not null default '{}',
  ts         timestamptz not null default now(),
  prev_hash  text,
  hash       text
);

-- ── Detection & response ────────────────────────────────────────────────────
create table folders (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name      text not null,
  parent_id uuid references folders(id) on delete set null
);

create table rules (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  title         text not null,
  severity      text not null default 'medium',
  type          text not null default 'query',
  enabled       bool not null default true,
  learning_mode bool not null default false,
  yaml          text not null,
  tags          text[] not null default '{}',
  mitre         text[] not null default '{}',
  author        text,
  folder_id     uuid references folders(id) on delete set null,
  version       int  not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table rule_versions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  rule_id    uuid not null references rules(id) on delete cascade,
  version    int not null,
  yaml       text not null,
  author     text,
  created_at timestamptz not null default now()
);

create table incidents (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  title           text not null,
  description     text,
  rule_id         uuid references rules(id) on delete set null,
  severity        text not null default 'medium',
  status          text not null default 'open',       -- open | in_progress | resolved
  assignee        text,
  tags            text[] not null default '{}',
  correlation_key text,
  detected_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create table cases (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  code        text,
  title       text not null,
  description text,
  status      text not null default 'open',           -- open | in_progress | closed
  assignee    text,
  tags        text[] not null default '{}',
  incident_id uuid references incidents(id) on delete set null,
  sla_due     timestamptz,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create table case_comments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  case_id    uuid not null references cases(id) on delete cascade,
  author     text,
  body       text not null,
  created_at timestamptz not null default now()
);

create table assets (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  kind       text not null,                            -- host | user | cloud | identity
  name       text not null,
  criticality text not null default 'normal',
  attributes jsonb not null default '{}',
  risk_score int not null default 0,
  updated_at timestamptz not null default now()
);

create table integrations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  provider   text not null,
  name       text not null,
  status     text not null default 'disconnected',     -- connected | disconnected | error
  config     jsonb not null default '{}',
  secret_ref text,
  health     jsonb not null default '{}'
);

create table playbooks (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name      text not null,
  spec      jsonb not null default '{}',
  enabled   bool not null default true
);

create table autonomy_policies (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  action_class text not null,                          -- notify | ticket | block_ip | isolate_host | disable_user
  mode         text not null default 'approve',        -- auto | approve | deny
  unique (tenant_id, action_class)
);

create table approvals (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  run_id     text not null,
  tool_name  text not null,
  args       jsonb not null default '{}',
  status     text not null default 'pending',          -- pending | approved | denied
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index on memberships (tenant_id, user_id);
create index on rules (tenant_id, enabled);
create index on incidents (tenant_id, status);
create index on cases (tenant_id, status);
create index on assets (tenant_id, kind);
create index on approvals (tenant_id, status);
create index on audit_log (tenant_id, ts);

-- ── Row-Level Security ──────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'memberships','roles','api_keys','audit_log','folders','rules','rule_versions',
    'incidents','cases','case_comments','assets','integrations','playbooks',
    'autonomy_policies','approvals'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$
      create policy tenant_isolation on %I
        using (tenant_id = app.current_tenant())
        with check (tenant_id = app.current_tenant());
    $f$, t);
  end loop;
end $$;

-- tenants: a user sees only tenants they belong to.
alter table tenants enable row level security;
create policy tenant_self on tenants
  using (id = app.current_tenant());
