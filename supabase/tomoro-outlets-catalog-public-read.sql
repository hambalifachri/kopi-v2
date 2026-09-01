create table if not exists public.tomoro_outlets_catalog (
  store_code text primary key,
  store_name text not null,
  store_address text,
  city text,
  latitude numeric,
  longitude numeric,
  raw_store jsonb not null default '{}'::jsonb,
  menu jsonb,
  source text not null default 'tomoro-official-sync',
  menu_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tomoro_outlets_catalog_store_name_idx
  on public.tomoro_outlets_catalog (store_name);

alter table public.tomoro_outlets_catalog enable row level security;

grant select on table public.tomoro_outlets_catalog to anon, authenticated;
grant select, insert, update, delete on table public.tomoro_outlets_catalog to service_role;

drop policy if exists "Public can read Tomoro outlet catalog"
  on public.tomoro_outlets_catalog;

create policy "Public can read Tomoro outlet catalog"
on public.tomoro_outlets_catalog
for select
to anon, authenticated
using (true);
