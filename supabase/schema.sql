-- Cofre — schema inicial. Rode no SQL Editor do Supabase (uma vez).
-- Tudo é isolado por usuário (RLS), então o app já nasce pronto para multiusuário.

create extension if not exists "pgcrypto";

-- Contas -------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'checking' check (kind in ('checking','savings','cash','card','investment')),
  initial_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Categorias (com limite mensal opcional) -----------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense','income')),
  monthly_limit numeric(14,2),
  created_at timestamptz not null default now()
);

-- Lançamentos ----------------------------------------------------------------
-- amount é sempre positivo; o sinal vem de "kind".
-- Parcelada/fixa geram várias linhas ligadas por series_id.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  kind text not null check (kind in ('expense','income')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  date date not null,
  paid boolean not null default false,
  repeat text not null default 'none' check (repeat in ('none','installment','fixed','yearly')),
  series_id uuid,
  installment_no int,
  installments_total int,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, date);
create index if not exists transactions_series_idx on public.transactions (series_id);

-- RLS ------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','transactions'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- Impede apontar para conta/categoria de outro usuário ----------------------
create or replace function public.check_transaction_owner() returns trigger
language plpgsql
set search_path = public as $$
begin
  if not exists (select 1 from public.accounts a where a.id = new.account_id and a.user_id = new.user_id) then
    raise exception 'conta inválida';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.user_id = new.user_id
  ) then
    raise exception 'categoria inválida';
  end if;
  return new;
end $$;

drop trigger if exists transactions_owner_check on public.transactions;
create trigger transactions_owner_check
  before insert or update on public.transactions
  for each row execute function public.check_transaction_owner();

-- Permissões da Data API (necessário se "Automatically expose new tables" estiver desmarcado;
-- inofensivo se estiver marcado, pois o RLS acima continua protegendo os dados).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.accounts, public.categories, public.transactions to authenticated;
