alter table public.app_settings
  add column if not exists kopken_max_3_items_enabled boolean not null default false;
comment on column public.app_settings.kopken_max_3_items_enabled is
  'TRUE: maksimal total 3 barang Kopi Kenangan per pesanan web; FALSE: tanpa batas ini.';
