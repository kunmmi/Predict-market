-- Limit orders for prediction markets.
--
-- A limit order is a user's request to buy a market position (yes/no) at or
-- below a target price. While open, the user's funds (stake + fee) are
-- reserved (moved from `available_balance` to `reserved_balance`).
--
-- A periodic matching cron compares each open order's `target_price` to the
-- market's live price. When current_price <= target_price, the order fires
-- and a real trade is executed against the reserved funds.

CREATE TABLE IF NOT EXISTS public.limit_orders (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  market_id       uuid not null references public.markets(id)  on delete cascade,
  side            text not null check (side in ('yes', 'no')),
  amount_stake    numeric(20,8) not null check (amount_stake > 0),
  fee_amount      numeric(20,8) not null default 0 check (fee_amount >= 0),
  target_price    numeric(20,8) not null check (target_price > 0 AND target_price < 1),
  status          text not null default 'open'
                  check (status in ('open', 'filled', 'cancelled', 'expired')),
  filled_trade_id uuid references public.trades(id) on delete set null,
  filled_at_price numeric(20,8),
  created_at      timestamptz not null default now(),
  filled_at       timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text
);

CREATE INDEX IF NOT EXISTS idx_limit_orders_profile ON public.limit_orders(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_limit_orders_market  ON public.limit_orders(market_id, status);
CREATE INDEX IF NOT EXISTS idx_limit_orders_open    ON public.limit_orders(status, market_id) WHERE status = 'open';

-- Enable RLS so users can only see their own orders via the regular client
ALTER TABLE public.limit_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY limit_orders_owner_select ON public.limit_orders
  FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- RPC: place_limit_order
--   Atomically reserves funds and inserts the order.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_limit_order(
  p_profile_id   uuid,
  p_market_id    uuid,
  p_side         text,
  p_amount       numeric,
  p_target_price numeric,
  p_fee_amount   numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_reserve numeric;
  v_order_id      uuid;
BEGIN
  v_total_reserve := p_amount + COALESCE(p_fee_amount, 0);

  -- Reserve funds atomically (will throw if insufficient available_balance)
  UPDATE public.wallets
  SET available_balance = available_balance - v_total_reserve,
      reserved_balance  = reserved_balance  + v_total_reserve
  WHERE profile_id = p_profile_id
    AND available_balance >= v_total_reserve;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient available balance for limit order.';
  END IF;

  INSERT INTO public.limit_orders (
    profile_id, market_id, side, amount_stake, fee_amount, target_price, status
  ) VALUES (
    p_profile_id, p_market_id, p_side, p_amount, COALESCE(p_fee_amount, 0), p_target_price, 'open'
  )
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: cancel_limit_order
--   Cancels an open order and refunds reserved funds back to available_balance.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_limit_order(
  p_order_id   uuid,
  p_profile_id uuid,
  p_reason     text DEFAULT 'user_cancelled'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount  numeric;
  v_fee     numeric;
  v_owner   uuid;
BEGIN
  SELECT amount_stake, fee_amount, profile_id
    INTO v_amount, v_fee, v_owner
  FROM public.limit_orders
  WHERE id = p_order_id AND status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Allow either the owner or an admin (when p_profile_id is the system one) to cancel
  IF v_owner <> p_profile_id THEN
    RAISE EXCEPTION 'Order does not belong to the caller.';
  END IF;

  UPDATE public.wallets
  SET available_balance = available_balance + (v_amount + COALESCE(v_fee, 0)),
      reserved_balance  = reserved_balance  - (v_amount + COALESCE(v_fee, 0))
  WHERE profile_id = v_owner;

  UPDATE public.limit_orders
  SET status        = 'cancelled',
      cancelled_at  = now(),
      cancel_reason = p_reason
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: fill_limit_order
--   Called by the matching cron when an order's target price is hit.
--   Atomically: releases reservation → calls place_trade → marks filled.
--   The entire operation is in one transaction; if place_trade fails
--   (e.g. market closed mid-flight), everything rolls back.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fill_limit_order(
  p_order_id                uuid,
  p_actual_price            numeric,
  p_entry_spot_price        numeric DEFAULT NULL,
  p_round_open_price        numeric DEFAULT NULL,
  p_time_remaining_seconds  integer DEFAULT NULL,
  p_reward_multiplier       numeric DEFAULT NULL,
  p_prediction_direction    text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order      public.limit_orders%ROWTYPE;
  v_trade_id   uuid;
  v_reserve    numeric;
BEGIN
  SELECT * INTO v_order FROM public.limit_orders
    WHERE id = p_order_id AND status = 'open'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Limit order % is not open', p_order_id;
  END IF;

  IF p_actual_price > v_order.target_price THEN
    RAISE EXCEPTION 'Actual price (%) exceeds target (%) — order not eligible to fill',
      p_actual_price, v_order.target_price;
  END IF;

  v_reserve := v_order.amount_stake + COALESCE(v_order.fee_amount, 0);

  -- Release the reservation: move reserved_balance back to available_balance
  -- (place_trade will then debit it normally via debit_wallet).
  UPDATE public.wallets
    SET available_balance = available_balance + v_reserve,
        reserved_balance  = reserved_balance  - v_reserve
    WHERE profile_id = v_order.profile_id;

  -- Execute the trade. If this fails (market closed, etc.), the whole
  -- transaction rolls back including the reservation release.
  v_trade_id := public.place_trade(
    v_order.profile_id,
    v_order.market_id,
    v_order.side::public.trade_side,
    v_order.amount_stake,
    p_actual_price,
    v_order.fee_amount,
    p_entry_spot_price,
    p_round_open_price,
    p_time_remaining_seconds,
    p_reward_multiplier,
    p_prediction_direction
  );

  UPDATE public.limit_orders
    SET status          = 'filled',
        filled_at       = now(),
        filled_at_price = p_actual_price,
        filled_trade_id = v_trade_id
    WHERE id = p_order_id;

  RETURN v_trade_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: expire_limit_orders_for_market
--   Called when a market closes — cancels all remaining open orders and
--   refunds reserved funds. Run by the settlement cron.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_limit_orders_for_market(p_market_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_order record;
BEGIN
  FOR v_order IN
    SELECT id, profile_id, amount_stake, fee_amount
    FROM public.limit_orders
    WHERE market_id = p_market_id AND status = 'open'
    FOR UPDATE
  LOOP
    UPDATE public.wallets
    SET available_balance = available_balance + (v_order.amount_stake + COALESCE(v_order.fee_amount, 0)),
        reserved_balance  = reserved_balance  - (v_order.amount_stake + COALESCE(v_order.fee_amount, 0))
    WHERE profile_id = v_order.profile_id;

    UPDATE public.limit_orders
    SET status        = 'expired',
        cancelled_at  = now(),
        cancel_reason = 'market_closed'
    WHERE id = v_order.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
