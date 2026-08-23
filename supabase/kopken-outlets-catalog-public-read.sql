alter table public.kopken_outlets_catalog enable row level security;

grant select on table public.kopken_outlets_catalog to anon, authenticated;

drop policy if exists "Public can read Kopken outlet catalog"
  on public.kopken_outlets_catalog;

create policy "Public can read Kopken outlet catalog"
on public.kopken_outlets_catalog
for select
to anon, authenticated
using (true);
