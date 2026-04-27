# Elemental — Database Schema

Target: **PostgreSQL / Supabase**

This file is the source of truth for the database schema. To set up a fresh environment:

1. Run **Section A** (the main block below) in the Supabase SQL Editor — creates all tables, enums, triggers, functions, views, and RLS policies.
2. Run **Section B** (at the bottom) — adds Chinese-language columns to the `markets` table. This was added after the initial schema via a migration.

### Objects created

**Tables**: `profiles`, `wallets`, `wallet_transactions`, `promoters`, `referrals`, `deposits`, `markets`, `market_prices`, `positions`, `trades`, `commissions`, `admin_logs`

**Views**: `v_admin_dashboard_summary`, `v_promoter_dashboard`, `v_wallet_summary`

**RPC functions**: `place_trade`, `approve_deposit`, `reject_deposit`, `settle_market`, `credit_wallet`, `debit_wallet`, `create_promoter`

**Triggers**: `on_auth_user_created`, `trg_create_wallet_for_profile`, `trg_create_referral_for_profile`

---

## Section A — Core Schema

---

```sql
-- =========================================================
-- CRYPTO PREDICTION MARKET MVP SCHEMA
-- Target: PostgreSQL / Supabase
-- =========================================================

-- ---------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('user', 'promoter', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'profile_status') then
    create type profile_status as enum ('active', 'inactive', 'suspended');
  end if;

  if not exists (select 1 from pg_type where typname = 'promoter_status') then
    create type promoter_status as enum ('active', 'inactive', 'suspended');
  end if;

  if not exists (select 1 from pg_type where typname = 'wallet_status') then
    create type wallet_status as enum ('active', 'locked', 'suspended');
  end if;

  if not exists (select 1 from pg_type where typname = 'wallet_tx_type') then
    create type wallet_tx_type as enum (
      'deposit',
      'trade_debit',
      'trade_credit',
      'fee_debit',
      'settlement_credit',
      'settlement_debit',
      'commission_credit',
      'adjustment_credit',
      'adjustment_debit'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'entry_direction') then
    create type entry_direction as enum ('credit', 'debit');
  end if;

  if not exists (select 1 from pg_type where typname = 'deposit_status') then
    create type deposit_status as enum ('pending', 'approved', 'rejected', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'market_status') then
    create type market_status as enum ('draft', 'active', 'closed', 'settled', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'market_outcome') then
    create type market_outcome as enum ('yes', 'no', 'unresolved', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'trade_side') then
    create type trade_side as enum ('yes', 'no');
  end if;

  if not exists (select 1 from pg_type where typname = 'trade_status') then
    create type trade_status as enum ('pending', 'executed', 'cancelled', 'settled');
  end if;

  if not exists (select 1 from pg_type where typname = 'position_status') then
    create type position_status as enum ('open', 'settled', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'commission_status') then
    create type commission_status as enum ('pending', 'approved', 'paid', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_action_type') then
    create type admin_action_type as enum (
      'deposit_approved',
      'deposit_rejected',
      'market_created',
      'market_updated',
      'market_closed',
      'market_settled',
      'market_cancelled',
      'commission_marked_paid',
      'wallet_adjusted',
      'user_updated',
      'promoter_updated'
    );
  end if;
end $$;

-- ---------------------------------------------------------
-- UPDATED AT TRIGGER FUNCTION
-- ---------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------
-- HELPER FUNCTION: GENERATE PROMO CODE
-- ---------------------------------------------------------

create or replace function public.generate_promo_code(input_name text default null)
returns text
language plpgsql
as $$
declare
  base_text text;
  candidate text;
begin
  base_text := upper(regexp_replace(coalesce(input_name, 'PROMO'), '[^A-Za-z0-9]', '', 'g'));

  if length(base_text) < 4 then
    base_text := 'PROMO';
  end if;

  candidate := left(base_text, 6) || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
  return candidate;
end;
$$;

-- ---------------------------------------------------------
-- PROFILES
-- Mirrors app-specific data for auth.users
-- ---------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role app_role not null default 'user',
  status profile_status not null default 'active',
  referred_by_promoter_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_auth_user_id on public.profiles(auth_user_id);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_referred_by_promoter_id on public.profiles(referred_by_promoter_id);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- PROMOTERS
-- One promoter record per promoter profile
-- ---------------------------------------------------------

create table if not exists public.promoters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text,
  promo_code text not null unique,
  status promoter_status not null default 'active',
  commission_rate numeric(5,4) not null default 0.1000,
  total_commission_generated numeric(20,8) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_promoters_commission_rate
    check (commission_rate >= 0 and commission_rate <= 1)
);

create index if not exists idx_promoters_profile_id on public.promoters(profile_id);
create index if not exists idx_promoters_promo_code on public.promoters(promo_code);
create index if not exists idx_promoters_status on public.promoters(status);

create trigger trg_promoters_updated_at
before update on public.promoters
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- REFERRALS
-- Permanent link between promoter and referred user
-- ---------------------------------------------------------

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters(id) on delete restrict,
  referred_profile_id uuid not null unique references public.profiles(id) on delete cascade,
  promo_code_used text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_referrals_promoter_id on public.referrals(promoter_id);
create index if not exists idx_referrals_referred_profile_id on public.referrals(referred_profile_id);

-- ---------------------------------------------------------
-- WALLETS
-- One internal wallet per profile
-- ---------------------------------------------------------

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  balance numeric(20,8) not null default 0,
  available_balance numeric(20,8) not null default 0,
  reserved_balance numeric(20,8) not null default 0,
  status wallet_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_wallet_balance_nonnegative check (balance >= 0),
  constraint chk_wallet_available_nonnegative check (available_balance >= 0),
  constraint chk_wallet_reserved_nonnegative check (reserved_balance >= 0),
  constraint chk_wallet_balance_consistency check (balance = available_balance + reserved_balance)
);

create index if not exists idx_wallets_profile_id on public.wallets(profile_id);

create trigger trg_wallets_updated_at
before update on public.wallets
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- WALLET TRANSACTIONS
-- Ledger of every wallet movement
-- ---------------------------------------------------------

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  transaction_type wallet_tx_type not null,
  reference_table text,
  reference_id uuid,
  asset_symbol text not null default 'USD',
  amount numeric(20,8) not null,
  direction entry_direction not null,
  balance_before numeric(20,8) not null,
  balance_after numeric(20,8) not null,
  description text,
  created_at timestamptz not null default now(),
  constraint chk_wallet_transactions_amount_positive check (amount > 0)
);

create index if not exists idx_wallet_transactions_wallet_id on public.wallet_transactions(wallet_id);
create index if not exists idx_wallet_transactions_profile_id on public.wallet_transactions(profile_id);
create index if not exists idx_wallet_transactions_reference on public.wallet_transactions(reference_table, reference_id);
create index if not exists idx_wallet_transactions_created_at on public.wallet_transactions(created_at desc);

-- ---------------------------------------------------------
-- DEPOSITS
-- User top-up requests
-- ---------------------------------------------------------

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  asset_symbol text not null,
  network_name text,
  amount_expected numeric(20,8),
  amount_received numeric(20,8),
  tx_hash text,
  deposit_address text,
  status deposit_status not null default 'pending',
  admin_reviewed_by uuid references public.profiles(id) on delete set null,
  admin_notes text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_deposits_asset_symbol
    check (asset_symbol in ('BTC', 'USDT', 'USDC', 'BNB', 'SOL')),
  constraint chk_deposits_amount_expected_nonnegative
    check (amount_expected is null or amount_expected > 0),
  constraint chk_deposits_amount_received_nonnegative
    check (amount_received is null or amount_received > 0)
);

create index if not exists idx_deposits_profile_id on public.deposits(profile_id);
create index if not exists idx_deposits_status on public.deposits(status);
create index if not exists idx_deposits_asset_symbol on public.deposits(asset_symbol);
create index if not exists idx_deposits_tx_hash on public.deposits(tx_hash);

create trigger trg_deposits_updated_at
before update on public.deposits
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- MARKETS
-- Yes/No prediction markets
-- ---------------------------------------------------------

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  category text,
  asset_symbol text not null,
  question_text text not null,
  rules_text text,
  close_at timestamptz not null,
  settle_at timestamptz not null,
  status market_status not null default 'draft',
  resolution_outcome market_outcome not null default 'unresolved',
  resolution_notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_markets_asset_symbol
    check (asset_symbol in ('BTC', 'ETH', 'SOL', 'BNB', 'USDT', 'USDC', 'XRP', 'ADA', 'DOGE')),
  constraint chk_markets_dates check (settle_at >= close_at)
);

create index if not exists idx_markets_status on public.markets(status);
create index if not exists idx_markets_asset_symbol on public.markets(asset_symbol);
create index if not exists idx_markets_close_at on public.markets(close_at);
create index if not exists idx_markets_settle_at on public.markets(settle_at);

create trigger trg_markets_updated_at
before update on public.markets
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- MARKET PRICES
-- Optional history table for displayed YES/NO prices
-- ---------------------------------------------------------

create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  yes_price numeric(10,4) not null,
  no_price numeric(10,4) not null,
  source text default 'internal',
  created_at timestamptz not null default now(),
  constraint chk_market_prices_yes_range check (yes_price >= 0 and yes_price <= 1),
  constraint chk_market_prices_no_range check (no_price >= 0 and no_price <= 1),
  constraint chk_market_prices_sum check (round((yes_price + no_price)::numeric, 4) = 1.0000)
);

create index if not exists idx_market_prices_market_id on public.market_prices(market_id);
create index if not exists idx_market_prices_created_at on public.market_prices(created_at desc);

-- ---------------------------------------------------------
-- TRADES
-- Each trade execution by a user
-- ---------------------------------------------------------

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  side trade_side not null,
  amount numeric(20,8) not null,
  price numeric(10,4) not null,
  fee_amount numeric(20,8) not null default 0,
  position_units numeric(20,8) not null,
  status trade_status not null default 'executed',
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint chk_trades_amount_positive check (amount > 0),
  constraint chk_trades_fee_nonnegative check (fee_amount >= 0),
  constraint chk_trades_price_range check (price > 0 and price <= 1),
  constraint chk_trades_position_units_positive check (position_units > 0)
);

create index if not exists idx_trades_profile_id on public.trades(profile_id);
create index if not exists idx_trades_market_id on public.trades(market_id);
create index if not exists idx_trades_created_at on public.trades(created_at desc);
create index if not exists idx_trades_status on public.trades(status);

-- ---------------------------------------------------------
-- POSITIONS
-- Aggregated exposure per user per market
-- ---------------------------------------------------------

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  yes_units numeric(20,8) not null default 0,
  no_units numeric(20,8) not null default 0,
  avg_yes_price numeric(10,4),
  avg_no_price numeric(10,4),
  status position_status not null default 'open',
  pnl_amount numeric(20,8) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, market_id),
  constraint chk_positions_yes_units_nonnegative check (yes_units >= 0),
  constraint chk_positions_no_units_nonnegative check (no_units >= 0),
  constraint chk_positions_avg_yes_range check (avg_yes_price is null or (avg_yes_price > 0 and avg_yes_price <= 1)),
  constraint chk_positions_avg_no_range check (avg_no_price is null or (avg_no_price > 0 and avg_no_price <= 1))
);

create index if not exists idx_positions_profile_id on public.positions(profile_id);
create index if not exists idx_positions_market_id on public.positions(market_id);
create index if not exists idx_positions_status on public.positions(status);

create trigger trg_positions_updated_at
before update on public.positions
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- COMMISSIONS
-- Promoter commissions generated from referred user trades
-- ---------------------------------------------------------

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.promoters(id) on delete cascade,
  referred_profile_id uuid not null references public.profiles(id) on delete cascade,
  trade_id uuid not null unique references public.trades(id) on delete cascade,
  fee_amount_source numeric(20,8) not null,
  commission_rate numeric(5,4) not null,
  commission_amount numeric(20,8) not null,
  status commission_status not null default 'pending',
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_commissions_fee_nonnegative check (fee_amount_source >= 0),
  constraint chk_commissions_rate_range check (commission_rate >= 0 and commission_rate <= 1),
  constraint chk_commissions_amount_nonnegative check (commission_amount >= 0)
);

create index if not exists idx_commissions_promoter_id on public.commissions(promoter_id);
create index if not exists idx_commissions_referred_profile_id on public.commissions(referred_profile_id);
create index if not exists idx_commissions_status on public.commissions(status);
create index if not exists idx_commissions_created_at on public.commissions(created_at desc);

create trigger trg_commissions_updated_at
before update on public.commissions
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- ADMIN LOGS
-- Records important admin actions
-- ---------------------------------------------------------

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid not null references public.profiles(id) on delete cascade,
  action_type admin_action_type not null,
  target_table text not null,
  target_id uuid not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_logs_admin_profile_id on public.admin_logs(admin_profile_id);
create index if not exists idx_admin_logs_target on public.admin_logs(target_table, target_id);
create index if not exists idx_admin_logs_created_at on public.admin_logs(created_at desc);

-- ---------------------------------------------------------
-- FOREIGN KEY FROM PROFILES TO PROMOTERS
-- Added after promoters table exists
-- ---------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'fk_profiles_referred_by_promoter'
      and table_name = 'profiles'
      and table_schema = 'public'
  ) then
    alter table public.profiles
    add constraint fk_profiles_referred_by_promoter
    foreign key (referred_by_promoter_id)
    references public.promoters(id)
    on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------
-- FUNCTION: CREATE PROFILE AFTER AUTH SIGNUP
-- Optional helper for Supabase Auth trigger
-- ---------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    auth_user_id,
    email,
    full_name,
    role,
    status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::app_role, 'user'),
    'active'
  );

  return new;
exception
  when others then
    raise log 'handle_new_user error: %', sqlerrm;
    return new;
end;
$$;

-- Drop and recreate auth trigger safely
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    drop trigger on_auth_user_created on auth.users;
  end if;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ---------------------------------------------------------
-- FUNCTION: CREATE WALLET FOR EVERY NEW PROFILE
-- ---------------------------------------------------------

create or replace function public.create_wallet_for_profile()
returns trigger
language plpgsql
as $$
begin
  insert into public.wallets (profile_id, balance, available_balance, reserved_balance, status)
  values (new.id, 0, 0, 0, 'active')
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_create_wallet_for_profile'
  ) then
    drop trigger trg_create_wallet_for_profile on public.profiles;
  end if;
end $$;

create trigger trg_create_wallet_for_profile
after insert on public.profiles
for each row
execute function public.create_wallet_for_profile();

-- ---------------------------------------------------------
-- FUNCTION: INSERT REFERRAL IF PROFILE HAS PROMOTER LINK
-- ---------------------------------------------------------

create or replace function public.create_referral_for_profile()
returns trigger
language plpgsql
as $$
declare
  v_promo_code text;
begin
  if new.referred_by_promoter_id is not null then
    select promo_code
      into v_promo_code
    from public.promoters
    where id = new.referred_by_promoter_id;

    insert into public.referrals (
      promoter_id,
      referred_profile_id,
      promo_code_used
    )
    values (
      new.referred_by_promoter_id,
      new.id,
      coalesce(v_promo_code, '')
    )
    on conflict (referred_profile_id) do nothing;
  end if;

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_trigger
    where tgname = 'trg_create_referral_for_profile'
  ) then
    drop trigger trg_create_referral_for_profile on public.profiles;
  end if;
end $$;

create trigger trg_create_referral_for_profile
after insert on public.profiles
for each row
execute function public.create_referral_for_profile();

-- ---------------------------------------------------------
-- FUNCTION: VALIDATE MARKET TRADE ELIGIBILITY
-- Optional helper function for backend logic
-- ---------------------------------------------------------

create or replace function public.is_market_tradeable(p_market_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.markets m
    where m.id = p_market_id
      and m.status = 'active'
      and now() < m.close_at
  );
$$;

-- ---------------------------------------------------------
-- FUNCTION: CREDIT WALLET
-- Reusable wallet credit helper
-- ---------------------------------------------------------

create or replace function public.credit_wallet(
  p_profile_id uuid,
  p_amount numeric,
  p_transaction_type wallet_tx_type,
  p_reference_table text,
  p_reference_id uuid,
  p_asset_symbol text,
  p_description text default null
)
returns void
language plpgsql
as $$
declare
  v_wallet public.wallets%rowtype;
  v_new_balance numeric(20,8);
begin
  if p_amount <= 0 then
    raise exception 'credit amount must be greater than zero';
  end if;

  select *
    into v_wallet
  from public.wallets
  where profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'wallet not found for profile %', p_profile_id;
  end if;

  v_new_balance := v_wallet.balance + p_amount;

  update public.wallets
  set balance = v_new_balance,
      available_balance = available_balance + p_amount
  where id = v_wallet.id;

  insert into public.wallet_transactions (
    wallet_id,
    profile_id,
    transaction_type,
    reference_table,
    reference_id,
    asset_symbol,
    amount,
    direction,
    balance_before,
    balance_after,
    description
  )
  values (
    v_wallet.id,
    p_profile_id,
    p_transaction_type,
    p_reference_table,
    p_reference_id,
    coalesce(p_asset_symbol, 'USD'),
    p_amount,
    'credit',
    v_wallet.balance,
    v_new_balance,
    p_description
  );
end;
$$;

-- ---------------------------------------------------------
-- FUNCTION: DEBIT WALLET
-- Reusable wallet debit helper
-- ---------------------------------------------------------

create or replace function public.debit_wallet(
  p_profile_id uuid,
  p_amount numeric,
  p_transaction_type wallet_tx_type,
  p_reference_table text,
  p_reference_id uuid,
  p_asset_symbol text,
  p_description text default null
)
returns void
language plpgsql
as $$
declare
  v_wallet public.wallets%rowtype;
  v_new_balance numeric(20,8);
begin
  if p_amount <= 0 then
    raise exception 'debit amount must be greater than zero';
  end if;

  select *
    into v_wallet
  from public.wallets
  where profile_id = p_profile_id
  for update;

  if not found then
    raise exception 'wallet not found for profile %', p_profile_id;
  end if;

  if v_wallet.available_balance < p_amount then
    raise exception 'insufficient available balance';
  end if;

  v_new_balance := v_wallet.balance - p_amount;

  update public.wallets
  set balance = v_new_balance,
      available_balance = available_balance - p_amount
  where id = v_wallet.id;

  insert into public.wallet_transactions (
    wallet_id,
    profile_id,
    transaction_type,
    reference_table,
    reference_id,
    asset_symbol,
    amount,
    direction,
    balance_before,
    balance_after,
    description
  )
  values (
    v_wallet.id,
    p_profile_id,
    p_transaction_type,
    p_reference_table,
    p_reference_id,
    coalesce(p_asset_symbol, 'USD'),
    p_amount,
    'debit',
    v_wallet.balance,
    v_new_balance,
    p_description
  );
end;
$$;

-- ---------------------------------------------------------
-- FUNCTION: APPROVE DEPOSIT
-- For V1 admin deposit approval flow
-- ---------------------------------------------------------

create or replace function public.approve_deposit(
  p_deposit_id uuid,
  p_admin_profile_id uuid,
  p_amount_received numeric default null,
  p_admin_notes text default null
)
returns void
language plpgsql
as $$
declare
  v_deposit public.deposits%rowtype;
  v_credit_amount numeric(20,8);
begin
  select *
    into v_deposit
  from public.deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'deposit not found';
  end if;

  if v_deposit.status <> 'pending' then
    raise exception 'only pending deposits can be approved';
  end if;

  v_credit_amount := coalesce(p_amount_received, v_deposit.amount_expected);

  if v_credit_amount is null or v_credit_amount <= 0 then
    raise exception 'approved deposit amount must be greater than zero';
  end if;

  update public.deposits
  set status = 'approved',
      amount_received = v_credit_amount,
      admin_reviewed_by = p_admin_profile_id,
      admin_notes = p_admin_notes,
      approved_at = now()
  where id = p_deposit_id;

  perform public.credit_wallet(
    v_deposit.profile_id,
    v_credit_amount,
    'deposit',
    'deposits',
    v_deposit.id,
    v_deposit.asset_symbol,
    'Approved deposit'
  );

  insert into public.admin_logs (
    admin_profile_id,
    action_type,
    target_table,
    target_id,
    notes
  )
  values (
    p_admin_profile_id,
    'deposit_approved',
    'deposits',
    p_deposit_id,
    p_admin_notes
  );
end;
$$;

-- ---------------------------------------------------------
-- FUNCTION: REJECT DEPOSIT
-- ---------------------------------------------------------

create or replace function public.reject_deposit(
  p_deposit_id uuid,
  p_admin_profile_id uuid,
  p_admin_notes text default null
)
returns void
language plpgsql
as $$
declare
  v_deposit public.deposits%rowtype;
begin
  select *
    into v_deposit
  from public.deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'deposit not found';
  end if;

  if v_deposit.status <> 'pending' then
    raise exception 'only pending deposits can be rejected';
  end if;

  update public.deposits
  set status = 'rejected',
      admin_reviewed_by = p_admin_profile_id,
      admin_notes = p_admin_notes,
      rejected_at = now()
  where id = p_deposit_id;

  insert into public.admin_logs (
    admin_profile_id,
    action_type,
    target_table,
    target_id,
    notes
  )
  values (
    p_admin_profile_id,
    'deposit_rejected',
    'deposits',
    p_deposit_id,
    p_admin_notes
  );
end;
$$;

-- ---------------------------------------------------------
-- FUNCTION: CREATE PROMOTER
-- Helper for backend if converting a profile to promoter
-- ---------------------------------------------------------

create or replace function public.create_promoter(
  p_profile_id uuid,
  p_display_name text,
  p_commission_rate numeric default 0.1000
)
returns uuid
language plpgsql
as $$
declare
  v_profile public.profiles%rowtype;
  v_promoter_id uuid;
  v_promo_code text;
begin
  select *
    into v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  if exists (select 1 from public.promoters where profile_id = p_profile_id) then
    raise exception 'promoter already exists for this profile';
  end if;

  v_promo_code := public.generate_promo_code(coalesce(p_display_name, v_profile.full_name));

  while exists (select 1 from public.promoters where promo_code = v_promo_code) loop
    v_promo_code := public.generate_promo_code(coalesce(p_display_name, v_profile.full_name));
  end loop;

  insert into public.promoters (
    profile_id,
    display_name,
    promo_code,
    commission_rate,
    status
  )
  values (
    p_profile_id,
    p_display_name,
    v_promo_code,
    p_commission_rate,
    'active'
  )
  returning id into v_promoter_id;

  update public.profiles
  set role = 'promoter'
  where id = p_profile_id;

  return v_promoter_id;
end;
$$;

-- ---------------------------------------------------------
-- FUNCTION: RECORD TRADE
-- Simplified MVP trade placement
-- ---------------------------------------------------------

create or replace function public.place_trade(
  p_profile_id uuid,
  p_market_id uuid,
  p_side trade_side,
  p_amount numeric,
  p_price numeric,
  p_fee_amount numeric default 0
)
returns uuid
language plpgsql
as $$
declare
  v_trade_id uuid;
  v_market public.markets%rowtype;
  v_position public.positions%rowtype;
  v_units numeric(20,8);
  v_total_debit numeric(20,8);
  v_promoter_id uuid;
  v_promoter_rate numeric(5,4);
  v_commission_amount numeric(20,8);
begin
  if p_amount <= 0 then
    raise exception 'trade amount must be greater than zero';
  end if;

  if p_price <= 0 or p_price > 1 then
    raise exception 'trade price must be > 0 and <= 1';
  end if;

  select *
    into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;

  if v_market.status <> 'active' or now() >= v_market.close_at then
    raise exception 'market is not tradeable';
  end if;

  v_total_debit := p_amount + coalesce(p_fee_amount, 0);
  v_units := p_amount / p_price;

  perform public.debit_wallet(
    p_profile_id,
    v_total_debit,
    'trade_debit',
    'markets',
    p_market_id,
    'USD',
    'Trade placement'
  );

  insert into public.trades (
    profile_id,
    market_id,
    side,
    amount,
    price,
    fee_amount,
    position_units,
    status
  )
  values (
    p_profile_id,
    p_market_id,
    p_side,
    p_amount,
    p_price,
    coalesce(p_fee_amount, 0),
    v_units,
    'executed'
  )
  returning id into v_trade_id;

  insert into public.positions (
    profile_id,
    market_id,
    yes_units,
    no_units,
    avg_yes_price,
    avg_no_price,
    status
  )
  values (
    p_profile_id,
    p_market_id,
    case when p_side = 'yes' then v_units else 0 end,
    case when p_side = 'no' then v_units else 0 end,
    case when p_side = 'yes' then p_price else null end,
    case when p_side = 'no' then p_price else null end,
    'open'
  )
  on conflict (profile_id, market_id)
  do update
  set
    yes_units = case
      when p_side = 'yes' then public.positions.yes_units + excluded.yes_units
      else public.positions.yes_units
    end,
    no_units = case
      when p_side = 'no' then public.positions.no_units + excluded.no_units
      else public.positions.no_units
    end,
    avg_yes_price = case
      when p_side = 'yes' then
        (
          (coalesce(public.positions.avg_yes_price, 0) * public.positions.yes_units) +
          (excluded.avg_yes_price * excluded.yes_units)
        ) / nullif(public.positions.yes_units + excluded.yes_units, 0)
      else public.positions.avg_yes_price
    end,
    avg_no_price = case
      when p_side = 'no' then
        (
          (coalesce(public.positions.avg_no_price, 0) * public.positions.no_units) +
          (excluded.avg_no_price * excluded.no_units)
        ) / nullif(public.positions.no_units + excluded.no_units, 0)
      else public.positions.avg_no_price
    end,
    status = 'open';

  if coalesce(p_fee_amount, 0) > 0 then
    perform public.debit_wallet(
      p_profile_id,
      p_fee_amount,
      'fee_debit',
      'trades',
      v_trade_id,
      'USD',
      'Platform fee'
    );
  end if;

  select p.referred_by_promoter_id
    into v_promoter_id
  from public.profiles p
  where p.id = p_profile_id;

  if v_promoter_id is not null and coalesce(p_fee_amount, 0) > 0 then
    select commission_rate
      into v_promoter_rate
    from public.promoters
    where id = v_promoter_id
      and status = 'active';

    if v_promoter_rate is not null then
      v_commission_amount := round((p_fee_amount * v_promoter_rate)::numeric, 8);

      insert into public.commissions (
        promoter_id,
        referred_profile_id,
        trade_id,
        fee_amount_source,
        commission_rate,
        commission_amount,
        status
      )
      values (
        v_promoter_id,
        p_profile_id,
        v_trade_id,
        p_fee_amount,
        v_promoter_rate,
        v_commission_amount,
        'pending'
      );

      update public.promoters
      set total_commission_generated = total_commission_generated + v_commission_amount
      where id = v_promoter_id;
    end if;
  end if;

  return v_trade_id;
end;
$$;

-- ---------------------------------------------------------
-- FUNCTION: SETTLE MARKET
-- Basic settlement for MVP
-- Winning positions paid 1.0 per unit
-- ---------------------------------------------------------

create or replace function public.settle_market(
  p_market_id uuid,
  p_resolution market_outcome,
  p_admin_profile_id uuid,
  p_notes text default null
)
returns void
language plpgsql
as $$
declare
  v_market public.markets%rowtype;
  v_position record;
  v_payout numeric(20,8);
begin
  if p_resolution not in ('yes', 'no', 'cancelled') then
    raise exception 'resolution must be yes, no, or cancelled';
  end if;

  select *
    into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market not found';
  end if;

  if v_market.status in ('settled', 'cancelled') then
    raise exception 'market already finalized';
  end if;

  update public.markets
  set status = case when p_resolution = 'cancelled' then 'cancelled' else 'settled' end,
      resolution_outcome = p_resolution,
      resolution_notes = p_notes,
      resolved_by = p_admin_profile_id,
      resolved_at = now()
  where id = p_market_id;

  for v_position in
    select *
    from public.positions
    where market_id = p_market_id
      and status = 'open'
  loop
    if p_resolution = 'yes' then
      v_payout := v_position.yes_units;
    elsif p_resolution = 'no' then
      v_payout := v_position.no_units;
    else
      -- Cancelled logic can be changed later to refund by cost basis if desired
      v_payout := 0;
    end if;

    if v_payout > 0 then
      perform public.credit_wallet(
        v_position.profile_id,
        v_payout,
        'settlement_credit',
        'markets',
        p_market_id,
        'USD',
        'Market settlement payout'
      );
    end if;

    update public.positions
    set status = case when p_resolution = 'cancelled' then 'cancelled' else 'settled' end,
        pnl_amount = v_payout
    where id = v_position.id;
  end loop;

  update public.trades
  set status = 'settled',
      settled_at = now()
  where market_id = p_market_id
    and status = 'executed';

  insert into public.admin_logs (
    admin_profile_id,
    action_type,
    target_table,
    target_id,
    notes
  )
  values (
    p_admin_profile_id,
    'market_settled',
    'markets',
    p_market_id,
    p_notes
  );
end;
$$;

-- ---------------------------------------------------------
-- BASIC VIEWS
-- ---------------------------------------------------------

create or replace view public.v_promoter_dashboard as
select
  pr.id as promoter_id,
  pr.profile_id,
  pr.display_name,
  pr.promo_code,
  pr.status,
  pr.commission_rate,
  pr.total_commission_generated,
  count(distinct r.referred_profile_id) as total_referred_users,
  count(distinct case when c.id is not null then r.referred_profile_id end) as active_referred_users,
  coalesce(sum(case when c.status = 'pending' then c.commission_amount else 0 end), 0) as pending_commission,
  coalesce(sum(case when c.status = 'approved' then c.commission_amount else 0 end), 0) as approved_commission,
  coalesce(sum(case when c.status = 'paid' then c.commission_amount else 0 end), 0) as paid_commission
from public.promoters pr
left join public.referrals r on r.promoter_id = pr.id
left join public.commissions c on c.promoter_id = pr.id
group by
  pr.id, pr.profile_id, pr.display_name, pr.promo_code, pr.status, pr.commission_rate, pr.total_commission_generated;

create or replace view public.v_wallet_summary as
select
  w.id as wallet_id,
  w.profile_id,
  p.email,
  p.full_name,
  w.balance,
  w.available_balance,
  w.reserved_balance,
  w.status,
  w.created_at,
  w.updated_at
from public.wallets w
join public.profiles p on p.id = w.profile_id;

create or replace view public.v_admin_dashboard_summary as
select
  (select count(*) from public.profiles) as total_profiles,
  (select count(*) from public.promoters) as total_promoters,
  (select count(*) from public.referrals) as total_referrals,
  (select count(*) from public.deposits) as total_deposits,
  (select count(*) from public.deposits where status = 'approved') as total_approved_deposits,
  (select count(*) from public.markets where status = 'active') as total_active_markets,
  (select count(*) from public.trades) as total_trades,
  (select coalesce(sum(amount), 0) from public.trades) as total_trade_volume,
  (select coalesce(sum(fee_amount), 0) from public.trades) as total_platform_fees,
  (select coalesce(sum(commission_amount), 0) from public.commissions) as total_promoter_commissions;

-- ---------------------------------------------------------
-- RLS ENABLEMENT
-- Enable now, policies can be refined as app grows
-- ---------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.promoters enable row level security;
alter table public.referrals enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.deposits enable row level security;
alter table public.markets enable row level security;
alter table public.market_prices enable row level security;
alter table public.trades enable row level security;
alter table public.positions enable row level security;
alter table public.commissions enable row level security;
alter table public.admin_logs enable row level security;

-- ---------------------------------------------------------
-- BASIC RLS POLICIES
-- These are starter policies for MVP
-- ---------------------------------------------------------

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = auth_user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = auth_user_id);

-- Wallets
drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
on public.wallets
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = wallets.profile_id
      and p.auth_user_id = auth.uid()
  )
);

-- Wallet transactions
drop policy if exists "wallet_transactions_select_own" on public.wallet_transactions;
create policy "wallet_transactions_select_own"
on public.wallet_transactions
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = wallet_transactions.profile_id
      and p.auth_user_id = auth.uid()
  )
);

-- Deposits
drop policy if exists "deposits_select_own" on public.deposits;
create policy "deposits_select_own"
on public.deposits
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = deposits.profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "deposits_insert_own" on public.deposits;
create policy "deposits_insert_own"
on public.deposits
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = deposits.profile_id
      and p.auth_user_id = auth.uid()
  )
);

-- Promoters
drop policy if exists "promoters_select_own" on public.promoters;
create policy "promoters_select_own"
on public.promoters
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = promoters.profile_id
      and p.auth_user_id = auth.uid()
  )
);

-- Referrals
drop policy if exists "referrals_select_own_promoter" on public.referrals;
create policy "referrals_select_own_promoter"
on public.referrals
for select
using (
  exists (
    select 1
    from public.promoters pr
    join public.profiles p on p.id = pr.profile_id
    where pr.id = referrals.promoter_id
      and p.auth_user_id = auth.uid()
  )
);

-- Markets
drop policy if exists "markets_public_select" on public.markets;
create policy "markets_public_select"
on public.markets
for select
using (true);

drop policy if exists "market_prices_public_select" on public.market_prices;
create policy "market_prices_public_select"
on public.market_prices
for select
using (true);

-- Trades
drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own"
on public.trades
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = trades.profile_id
      and p.auth_user_id = auth.uid()
  )
);

-- Positions
drop policy if exists "positions_select_own" on public.positions;
create policy "positions_select_own"
on public.positions
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = positions.profile_id
      and p.auth_user_id = auth.uid()
  )
);

-- Commissions
drop policy if exists "commissions_select_own_promoter" on public.commissions;
create policy "commissions_select_own_promoter"
on public.commissions
for select
using (
  exists (
    select 1
    from public.promoters pr
    join public.profiles p on p.id = pr.profile_id
    where pr.id = commissions.promoter_id
      and p.auth_user_id = auth.uid()
  )
);

-- Admin logs: no public access by default
drop policy if exists "admin_logs_no_public_access" on public.admin_logs;
create policy "admin_logs_no_public_access"
on public.admin_logs
for select
using (false);

-- ---------------------------------------------------------
-- OPTIONAL SEED COMMENTS
-- ---------------------------------------------------------
comment on table public.profiles is 'Application user profiles linked to Supabase auth users';
comment on table public.promoters is 'Promoter/affiliate profiles with promo codes';
comment on table public.referrals is 'Referral mapping between promoters and referred profiles';
comment on table public.wallets is 'Internal wallet balances per profile';
comment on table public.wallet_transactions is 'Wallet ledger for every balance movement';
comment on table public.deposits is 'User top-up requests for supported crypto assets';
comment on table public.markets is 'Yes/No crypto prediction markets';
comment on table public.market_prices is 'Historical displayed price points for markets';
comment on table public.trades is 'Trade executions on markets';
comment on table public.positions is 'Aggregated open/settled market exposure per profile';
comment on table public.commissions is 'Promoter commissions generated from referred user trades';
comment on table public.admin_logs is 'Audit log of admin actions';
```

---

## Section B — Post-Initial Migrations

Run these after Section A. They add features built beyond the original MVP scope.

### B1 — Chinese language columns on `markets`

Added to support full EN/ZH bilingual market content. When `lang = 'zh'`, the platform reads from these columns and falls back to the English column if the `_zh` column is `NULL`.

```sql
-- supabase/migrations/20260415_market_zh_fields.sql
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS title_zh          text,
  ADD COLUMN IF NOT EXISTS description_zh    text,
  ADD COLUMN IF NOT EXISTS question_text_zh  text,
  ADD COLUMN IF NOT EXISTS rules_text_zh     text;
```

---

## Schema notes

### Wallet balance invariant

The `wallets` table enforces `balance = available_balance + reserved_balance` via a CHECK constraint. Every balance change must go through `credit_wallet()` or `debit_wallet()` to maintain this invariant and produce a `wallet_transactions` ledger entry.

### Market pricing

`market_prices` stores a time-series of YES/NO prices for each market. The `source` column distinguishes where the price came from:

| Source | Description |
|---|---|
| `volume` | Calculated by the CPMM AMM engine after a trade |
| `cron` | Set by the hourly barrier-option probability updater |
| `manual` | Set directly by an admin |
| `internal` | Legacy/default label |

The latest row per market (by `created_at DESC`) is the displayed price.

### Trade debit model

`place_trade` debits `p_amount + p_fee_amount` in a single `trade_debit` wallet transaction. The fee is also recorded separately in the `trades.fee_amount` column for reporting. No double-debit occurs.

### Commission generation

Commissions are generated automatically inside `place_trade` when:
- `p_fee_amount > 0`, AND
- the trading user has a `referred_by_promoter_id` in their profile, AND
- that promoter's status is `'active'`

Commission rate comes from `promoters.commission_rate` (default 10%).

### Settlement model

`settle_market` credits winning positions at **$1.00 per unit**. Position units are calculated at trade time as `amount / price`. A user who buys YES at $0.50 with $100 receives 200 units; if YES resolves, they receive $200.

### RLS model

All tables use Row Level Security. User-facing reads are scoped to the authenticated user's own data. All writes that require cross-table access (trades, deposits, settlements) go through the Supabase service role key via the admin client — authentication is validated in the API route before calling any RPC.
