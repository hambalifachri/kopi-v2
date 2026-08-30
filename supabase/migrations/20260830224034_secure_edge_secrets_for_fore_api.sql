create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.edge_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table private.edge_secrets enable row level security;
revoke all on table private.edge_secrets from public, anon, authenticated;
grant select, insert, update on table private.edge_secrets to service_role;

create or replace function public.get_edge_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select value
  from private.edge_secrets
  where name = secret_name
  limit 1
$$;

revoke all on function public.get_edge_secret(text) from public, anon, authenticated;
grant execute on function public.get_edge_secret(text) to service_role;
