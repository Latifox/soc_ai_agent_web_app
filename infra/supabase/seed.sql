-- Local dev seed: a demo tenant, admin user/membership, and one sample rule.
-- The tenant id matches the ClickHouse seed (infra/seed.py) so cross-store joins line up.

insert into tenants (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Demo Org', 'demo')
on conflict (id) do nothing;

insert into users (id, email, name)
values ('22222222-2222-2222-2222-222222222222', 'admin@demo.local', 'Demo Admin')
on conflict (id) do nothing;

insert into memberships (tenant_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'admin')
on conflict (tenant_id, user_id) do nothing;

insert into rules (tenant_id, title, severity, type, yaml, tags, mitre, author)
values (
  '11111111-1111-1111-1111-111111111111',
  'Systems using many different protocols',
  'low', 'advanced_threshold',
$yaml$title: Systems using many different protocols
severity: low
type: advanced_threshold
depth: 1h
query: event.category:network AND event.type:allowed AND event.action:accept
threshold:
  group_by: [source.ip]
  aggregate: cardinality(destination.port)
  operator: ">"
  value: 50
$yaml$,
  '{discovery, attack.initial_access}', '{T1046}', 'admin@demo.local'
);
