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

alter table public.orders
  add column if not exists reseller_code text,
  add column if not exists reseller_name text,
  add column if not exists reseller_discount integer not null default 0;

-- Membership reseller dibuat admin setelah pembayaran Rp25.000 / 30 hari.
create table if not exists public.resellers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  phone text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.resellers enable row level security;
revoke all on table public.resellers from anon, authenticated;

create or replace function public.verify_reseller_code(p_code text, p_phone text)
returns table (code text, name text, phone text, expires_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select r.code, r.name, r.phone, r.expires_at
  from public.resellers r
  where upper(trim(r.code)) = upper(trim(p_code))
    and regexp_replace(r.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    and r.status = 'active'
    and r.starts_at <= now()
    and r.expires_at > now()
  limit 1;
$$;

revoke all on function public.verify_reseller_code(text, text) from public;
grant execute on function public.verify_reseller_code(text, text) to anon, authenticated;

-- Daftarkan UID akun Supabase Auth yang boleh membuka halaman admin reseller.
create table if not exists public.reseller_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.reseller_admins enable row level security;
revoke all on table public.reseller_admins from anon, authenticated;

create or replace function public.admin_create_reseller(p_name text, p_phone text, p_days integer default 30)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  new_expiry timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from public.reseller_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'Akun ini bukan admin reseller';
  end if;

  if trim(coalesce(p_name, '')) = '' or trim(coalesce(p_phone, '')) = '' then
    raise exception 'Nama dan WhatsApp wajib diisi';
  end if;

  if p_days not in (30, 60, 90) then
    raise exception 'Masa aktif tidak valid';
  end if;

  new_code := 'KF-RSL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  new_expiry := now() + make_interval(days => p_days);

  insert into public.resellers (code, name, phone, expires_at)
  values (new_code, trim(p_name), regexp_replace(p_phone, '\D', '', 'g'), new_expiry);

  return query select new_code, new_expiry;
end;
$$;

revoke all on function public.admin_create_reseller(text, text, integer) from public;
grant execute on function public.admin_create_reseller(text, text, integer) to authenticated;

-- Contoh membuat kode baru (nomor disimpan dengan format 62):
-- insert into public.resellers (code, name, phone, expires_at)
-- values ('KF-RSL-ABC123', 'Nama Reseller', '6281234567890', now() + interval '30 days');

-- Setelah membuat user admin di Authentication > Users, daftarkan UID-nya sekali:
-- insert into public.reseller_admins (user_id) values ('UID-USER-DARI-SUPABASE');

-- Jalankan sekali untuk pengaturan minimum order dari Dashboard Supabase.
create table if not exists public.app_settings (
  id integer primary key,
  kopken_minimum_enabled boolean not null default false,
  kopken_minimum_official_total integer not null default 50000,
  all_stores_closed boolean not null default false,
  store_closed_message text not null default 'Maaf, semua toko sedang tutup sementara. Silakan kembali lagi nanti.'
);

alter table public.app_settings
  add column if not exists kopken_minimum_enabled boolean not null default false,
  add column if not exists kopken_minimum_official_total integer not null default 50000,
  add column if not exists all_stores_closed boolean not null default false,
  add column if not exists store_closed_message text not null default 'Maaf, semua toko sedang tutup sementara. Silakan kembali lagi nanti.';

insert into public.app_settings (id, kopken_minimum_enabled, kopken_minimum_official_total)
values (1, false, 50000)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "Allow public app settings read" on public.app_settings;
create policy "Allow public app settings read"
on public.app_settings
for select
to anon
using (true);

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
