-- =============================================================================
-- Migration: Two-tier promoter commissions
--
-- Tier 1 (direct referrals):   30% of the trading fee
-- Tier 2 (indirect referrals): 10% of the trading fee
--
-- Example: Promoter A refers Alice. Alice refers Bob.
--   Bob trades → Alice earns 30% of fee (tier 1)
--              → Promoter A earns 10% of fee (tier 2)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Update commissions table for two-tier support
-- ---------------------------------------------------------------------------

-- Drop the old unique constraint on trade_id (one trade now produces two rows)
alter table public.commissions
  drop constraint if exists commissions_trade_id_key;

-- Add tier column
alter table public.commissions
  add column if not exists tier smallint not null default 1
    constraint chk_commissions_tier check (tier in (1, 2));

-- One commission row per (trade, promoter) pair
alter table public.commissions
  drop constraint if exists commissions_trade_id_promoter_id_key;

alter table public.commissions
  add constraint commissions_trade_id_promoter_id_key
  unique (trade_id, promoter_id);

create index if not exists idx_commissions_tier on public.commissions(tier);

comment on column public.commissions.tier is
  '1 = direct referral commission (30%), 2 = indirect referral commission (10%)';

-- ---------------------------------------------------------------------------
-- 2. Update default commission_rate to 30% on promoters table
-- ---------------------------------------------------------------------------
alter table public.promoters
  alter column commission_rate set default 0.3000;

-- Migrate existing promoters that still have the old 10% default
update public.promoters
  set commission_rate = 0.3000
  where commission_rate = 0.1000;

-- ---------------------------------------------------------------------------
-- 3. Update create_promoter function — new default is 30%
-- ---------------------------------------------------------------------------
create or replace function public.create_promoter(
  p_profile_id uuid,
  p_display_name text,
  p_commission_rate numeric default 0.3000
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

-- ---------------------------------------------------------------------------
-- 4. Replace place_trade with two-tier commission support
-- ---------------------------------------------------------------------------
create or replace function public.place_trade(
  p_profile_id uuid,
  p_market_id uuid,
  p_side trade_side,
  p_amount numeric,
  p_price numeric,
  p_fee_amount numeric default 0,
  p_entry_spot_price numeric default null,
  p_round_open_price numeric default null,
  p_time_remaining_seconds integer default null,
  p_reward_multiplier numeric default null,
  p_prediction_direction text default null
)
returns uuid
language plpgsql
as $$
declare
  v_trade_id uuid;
  v_market public.markets%rowtype;
  v_units numeric(20,8);
  v_total_debit numeric(20,8);
  -- tier 1 (direct referrer)
  v_promoter_id uuid;
  v_promoter_rate numeric(5,4);
  v_commission_amount numeric(20,8);
  -- tier 2 (indirect referrer — promoter of the tier-1 promoter)
  v_tier2_promoter_id uuid;
  v_tier2_profile_id uuid;
  v_tier2_commission_amount numeric(20,8);
  v_tier2_rate constant numeric := 0.10;
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

  if now() >= coalesce(v_market.cutoff_at, v_market.close_at) then
    raise exception 'Predictions closed for this round. Next round starts soon.';
  end if;

  if v_market.duration_minutes is not null then
    if p_entry_spot_price is null or p_entry_spot_price <= 0 then
      raise exception 'entry spot price is required for short-duration trades';
    end if;

    if p_round_open_price is null or p_round_open_price <= 0 then
      raise exception 'round opening price is required for short-duration trades';
    end if;

    if p_time_remaining_seconds is null or p_time_remaining_seconds < 0 then
      raise exception 'time remaining is required for short-duration trades';
    end if;

    if p_reward_multiplier is null or p_reward_multiplier < 0 then
      raise exception 'reward multiplier is required for short-duration trades';
    end if;

    if p_prediction_direction is null or p_prediction_direction not in ('up', 'down') then
      raise exception 'prediction direction is required for short-duration trades';
    end if;
  end if;

  v_total_debit := p_amount;
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

  if v_market.duration_minutes is not null then
    insert into public.predictions (
      trade_id,
      user_id,
      round_id,
      direction,
      entry_price,
      round_open_price,
      entry_time,
      time_remaining_seconds,
      reward_multiplier,
      prediction_locked
    )
    values (
      v_trade_id,
      p_profile_id,
      p_market_id,
      p_prediction_direction,
      p_entry_spot_price,
      p_round_open_price,
      now(),
      p_time_remaining_seconds,
      p_reward_multiplier,
      true
    );
  end if;

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

    perform public.credit_platform_wallet(
      p_fee_amount,
      'fee_credit',
      'trades',
      v_trade_id,
      'USDT',
      'Platform fee collected'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Tier 1 commission: direct referrer earns their commission_rate % of fee
  -- -------------------------------------------------------------------------
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
        status,
        tier
      )
      values (
        v_promoter_id,
        p_profile_id,
        v_trade_id,
        p_fee_amount,
        v_promoter_rate,
        v_commission_amount,
        'pending',
        1
      );

      update public.promoters
        set total_commission_generated = total_commission_generated + v_commission_amount
        where id = v_promoter_id;
    end if;

    -- -----------------------------------------------------------------------
    -- Tier 2 commission: the promoter who referred the tier-1 promoter earns
    -- a fixed 10% of the same fee.
    -- Walk up: trader → tier-1 promoter's profile → tier-2 promoter
    -- -----------------------------------------------------------------------
    select pr.profile_id
      into v_tier2_profile_id
    from public.promoters pr
    where pr.id = v_promoter_id;

    if v_tier2_profile_id is not null then
      select p.referred_by_promoter_id
        into v_tier2_promoter_id
      from public.profiles p
      where p.id = v_tier2_profile_id;

      -- Guard: tier-2 promoter must exist, be active, and be different from tier-1
      if v_tier2_promoter_id is not null
         and v_tier2_promoter_id <> v_promoter_id
         and exists (
           select 1 from public.promoters
           where id = v_tier2_promoter_id and status = 'active'
         )
      then
        v_tier2_commission_amount := round((p_fee_amount * v_tier2_rate)::numeric, 8);

        insert into public.commissions (
          promoter_id,
          referred_profile_id,
          trade_id,
          fee_amount_source,
          commission_rate,
          commission_amount,
          status,
          tier
        )
        values (
          v_tier2_promoter_id,
          p_profile_id,
          v_trade_id,
          p_fee_amount,
          v_tier2_rate,
          v_tier2_commission_amount,
          'pending',
          2
        );

        update public.promoters
          set total_commission_generated = total_commission_generated + v_tier2_commission_amount
          where id = v_tier2_promoter_id;
      end if;
    end if;
  end if;

  return v_trade_id;
end;
$$;
