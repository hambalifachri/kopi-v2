create table if not exists public.orders (
  id text primary key,
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  note text,
  items jsonb not null,
  subtotal integer not null,
  payment_proof_name text not null,
  payment_proof_type text,
  payment_proof_size integer,
  payment_proof_path text not null,
  payment_proof_url text not null
);

alter table public.orders enable row level security;

drop policy if exists "Allow public order insert" on public.orders;
create policy "Allow public order insert"
on public.orders
for insert
to anon
with check (true);

drop policy if exists "Allow public order read" on public.orders;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Allow public proof upload" on storage.objects;
create policy "Allow public proof upload"
on storage.objects
for insert
to anon
with check (bucket_id = 'payment-proofs');

drop policy if exists "Allow public proof read" on storage.objects;
create policy "Allow public proof read"
on storage.objects
for select
to anon
using (bucket_id = 'payment-proofs');
