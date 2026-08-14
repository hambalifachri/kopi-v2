alter table public.dana_expenses
  add column if not exists expense_type text not null default 'outlet';

alter table public.dana_expenses
  drop constraint if exists dana_expenses_expense_type_check;

alter table public.dana_expenses
  add constraint dana_expenses_expense_type_check
  check (expense_type in ('outlet', 'refund', 'other'));
