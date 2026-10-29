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

-- Metas e investimentos ------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  target_date date,
  created_at timestamptz not null default now()
);
create table if not exists public.goal_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount numeric(14,2) not null check (amount <> 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'renda_fixa' check (kind in ('renda_fixa','acoes','fiis','cripto','tesouro','outro')),
  current_value numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.investment_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  amount numeric(14,2) not null check (amount <> 0), -- positivo = aporte, negativo = resgate
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists goal_moves_goal_idx on public.goal_moves (goal_id);
create index if not exists investment_moves_inv_idx on public.investment_moves (investment_id);

alter table public.goals enable row level security;
alter table public.goal_moves enable row level security;
alter table public.investments enable row level security;
alter table public.investment_moves enable row level security;

do $$
declare t text;
begin
  foreach t in array array['goals','goal_moves','investments','investment_moves'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

create or replace function public.check_child_owner() returns trigger
language plpgsql
set search_path = public as $$
begin
  if tg_table_name = 'goal_moves' then
    if not exists (select 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id) then
      raise exception 'meta inválida';
    end if;
  elsif tg_table_name = 'investment_moves' then
    if not exists (select 1 from public.investments i where i.id = new.investment_id and i.user_id = new.user_id) then
      raise exception 'investimento inválido';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists goal_moves_owner_check on public.goal_moves;
create trigger goal_moves_owner_check before insert or update on public.goal_moves
  for each row execute function public.check_child_owner();
drop trigger if exists investment_moves_owner_check on public.investment_moves;
create trigger investment_moves_owner_check before insert or update on public.investment_moves
  for each row execute function public.check_child_owner();

grant select, insert, update, delete on public.goals, public.goal_moves, public.investments, public.investment_moves to authenticated;

-- Renovação automática das fixas, meta ligada a investimento e dívidas --------
alter table public.transactions add column if not exists auto_renew boolean not null default true;
alter table public.goals add column if not exists investment_id uuid references public.investments(id) on delete set null;

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  creditor text,
  original_amount numeric(14,2) not null check (original_amount > 0),
  current_balance numeric(14,2) not null check (current_balance >= 0),
  monthly_rate numeric(6,3) not null default 0 check (monthly_rate >= 0),
  monthly_payment numeric(14,2) not null default 0 check (monthly_payment >= 0),
  created_at timestamptz not null default now()
);
alter table public.debts enable row level security;
drop policy if exists "own rows" on public.debts;
create policy "own rows" on public.debts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.debts to authenticated;

-- ===== Importação, compartilhamento e patrimônio =====
alter table public.transactions add column if not exists external_id text;
create unique index if not exists transactions_account_external_idx on public.transactions (account_id, external_id);
-- household_members, data_owner() e net_worth_snapshots: veja as migrations aplicadas no projeto Supabase
-- (todas as tabelas de dados usam user_id default data_owner() e policy user_id = data_owner()).

-- Gasto sem remorso: regras por usuário (compartilhadas via data_owner())
create table if not exists public.free_spend_settings (
  user_id uuid primary key default public.data_owner() references auth.users(id) on delete cascade,
  savings_pct numeric(5,2) not null default 20 check (savings_pct >= 0 and savings_pct <= 90),
  buffer_pct numeric(5,2) not null default 10 check (buffer_pct >= 0 and buffer_pct <= 50),
  category_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.free_spend_settings enable row level security;
create policy "fss select" on public.free_spend_settings for select using (user_id = public.data_owner());
create policy "fss insert" on public.free_spend_settings for insert with check (user_id = public.data_owner());
create policy "fss update" on public.free_spend_settings for update using (user_id = public.data_owner()) with check (user_id = public.data_owner());
create policy "fss delete" on public.free_spend_settings for delete using (user_id = public.data_owner());

-- Lista de desejos (ligada à verba do Gasto sem remorso)
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.data_owner() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  price numeric(14,2) not null check (price > 0),
  priority smallint not null default 2 check (priority between 1 and 3),
  url text,
  wait_until date,
  bought_at date,
  created_at timestamptz not null default now()
);
create index if not exists wishlist_items_user_idx on public.wishlist_items (user_id, bought_at);
alter table public.wishlist_items enable row level security;
create policy "wish select" on public.wishlist_items for select using (user_id = public.data_owner());
create policy "wish insert" on public.wishlist_items for insert with check (user_id = public.data_owner());
create policy "wish update" on public.wishlist_items for update using (user_id = public.data_owner()) with check (user_id = public.data_owner());
create policy "wish delete" on public.wishlist_items for delete using (user_id = public.data_owner());
