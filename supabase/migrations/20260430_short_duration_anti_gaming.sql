-- Migration: short-duration anti-gaming protections
-- Adds server-owned cutoff + prediction snapshot logic for 3/5/10/15-minute rounds.

ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS cutoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_spot_price numeric(20,8) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS round_result text DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_markets_round_result'
  ) THEN
    ALTER TABLE public.markets
      ADD CONSTRAINT chk_markets_round_result
        CHECK (round_result IS NULL OR round_result IN ('up', 'down', 'flat'));
  END IF;
END $$;

UPDATE public.markets
SET cutoff_at = CASE
  WHEN duration_minutes IS NOT NULL THEN close_at - interval '15 seconds'
  ELSE close_at
END
WHERE cutoff_at IS NULL;

ALTER TABLE public.markets
  ALTER COLUMN cutoff_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_markets_cutoff_at ON public.markets(cutoff_at);
CREATE INDEX IF NOT EXISTS idx_markets_round_result ON public.markets(round_result);

COMMENT ON COLUMN public.markets.cutoff_at IS 'Server-authoritative prediction cutoff. Short-duration markets stop accepting new entries 15 seconds before close_at.';
COMMENT ON COLUMN public.markets.final_spot_price IS 'Final Binance spot price captured when the round is settled.';
COMMENT ON COLUMN public.markets.round_result IS 'Short-duration round result: up, down, or flat.';

CREATE TABLE IF NOT EXISTS public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL UNIQUE REFERENCES public.trades(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  direction text NOT NULL,
  entry_price numeric(20,8) NOT NULL,
  round_open_price numeric(20,8) NOT NULL,
  entry_time timestamptz NOT NULL DEFAULT now(),
  time_remaining_seconds integer NOT NULL,
  reward_multiplier numeric(10,6) NOT NULL,
  prediction_locked boolean NOT NULL DEFAULT true,
  settled boolean NOT NULL DEFAULT false,
  points_awarded numeric(20,8) NOT NULL DEFAULT 0,
  outcome text,
  settled_at timestamptz,
  CONSTRAINT chk_predictions_direction
    CHECK (direction IN ('up', 'down')),
  CONSTRAINT chk_predictions_entry_price_positive
    CHECK (entry_price > 0),
  CONSTRAINT chk_predictions_round_open_price_positive
    CHECK (round_open_price > 0),
  CONSTRAINT chk_predictions_time_remaining_nonnegative
    CHECK (time_remaining_seconds >= 0),
  CONSTRAINT chk_predictions_reward_multiplier_nonnegative
    CHECK (reward_multiplier >= 0),
  CONSTRAINT chk_predictions_outcome
    CHECK (outcome IS NULL OR outcome IN ('up', 'down', 'flat'))
);

CREATE INDEX IF NOT EXISTS idx_predictions_profile_id ON public.predictions(profile_id);
CREATE INDEX IF NOT EXISTS idx_predictions_market_id ON public.predictions(market_id);
CREATE INDEX IF NOT EXISTS idx_predictions_trade_id ON public.predictions(trade_id);
CREATE INDEX IF NOT EXISTS idx_predictions_entry_time ON public.predictions(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_settled ON public.predictions(settled);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "predictions_select_own" ON public.predictions;
CREATE POLICY "predictions_select_own"
ON public.predictions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = predictions.profile_id
      AND p.auth_user_id = auth.uid()
  )
);

COMMENT ON TABLE public.predictions IS 'Immutable prediction snapshots for short-duration round entries.';

CREATE OR REPLACE FUNCTION public.place_trade(
  p_profile_id uuid,
  p_market_id uuid,
  p_side trade_side,
  p_amount numeric,
  p_price numeric,
  p_fee_amount numeric DEFAULT 0,
  p_entry_spot_price numeric DEFAULT NULL,
  p_round_open_price numeric DEFAULT NULL,
  p_time_remaining_seconds integer DEFAULT NULL,
  p_reward_multiplier numeric DEFAULT NULL,
  p_prediction_direction text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_trade_id uuid;
  v_market public.markets%rowtype;
  v_units numeric(20,8);
  v_total_debit numeric(20,8);
  v_promoter_id uuid;
  v_promoter_rate numeric(5,4);
  v_commission_amount numeric(20,8);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'trade amount must be greater than zero';
  END IF;

  IF p_price <= 0 OR p_price > 1 THEN
    RAISE EXCEPTION 'trade price must be > 0 and <= 1';
  END IF;

  SELECT *
    INTO v_market
  FROM public.markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'market not found';
  END IF;

  IF v_market.status <> 'active' OR now() >= v_market.close_at THEN
    RAISE EXCEPTION 'market is not tradeable';
  END IF;

  IF now() >= coalesce(v_market.cutoff_at, v_market.close_at) THEN
    RAISE EXCEPTION 'Predictions closed for this round. Next round starts soon.';
  END IF;

  IF v_market.duration_minutes IS NOT NULL THEN
    IF p_entry_spot_price IS NULL OR p_entry_spot_price <= 0 THEN
      RAISE EXCEPTION 'entry spot price is required for short-duration trades';
    END IF;

    IF p_round_open_price IS NULL OR p_round_open_price <= 0 THEN
      RAISE EXCEPTION 'round opening price is required for short-duration trades';
    END IF;

    IF p_time_remaining_seconds IS NULL OR p_time_remaining_seconds < 0 THEN
      RAISE EXCEPTION 'time remaining is required for short-duration trades';
    END IF;

    IF p_reward_multiplier IS NULL OR p_reward_multiplier < 0 THEN
      RAISE EXCEPTION 'reward multiplier is required for short-duration trades';
    END IF;

    IF p_prediction_direction IS NULL OR p_prediction_direction NOT IN ('up', 'down') THEN
      RAISE EXCEPTION 'prediction direction is required for short-duration trades';
    END IF;
  END IF;

  v_total_debit := p_amount;
  v_units := p_amount / p_price;

  PERFORM public.debit_wallet(
    p_profile_id,
    v_total_debit,
    'trade_debit',
    'markets',
    p_market_id,
    'USD',
    'Trade placement'
  );

  INSERT INTO public.trades (
    profile_id,
    market_id,
    side,
    amount,
    price,
    fee_amount,
    position_units,
    status
  )
  VALUES (
    p_profile_id,
    p_market_id,
    p_side,
    p_amount,
    p_price,
    coalesce(p_fee_amount, 0),
    v_units,
    'executed'
  )
  RETURNING id INTO v_trade_id;

  INSERT INTO public.positions (
    profile_id,
    market_id,
    yes_units,
    no_units,
    avg_yes_price,
    avg_no_price,
    status
  )
  VALUES (
    p_profile_id,
    p_market_id,
    CASE WHEN p_side = 'yes' THEN v_units ELSE 0 END,
    CASE WHEN p_side = 'no' THEN v_units ELSE 0 END,
    CASE WHEN p_side = 'yes' THEN p_price ELSE NULL END,
    CASE WHEN p_side = 'no' THEN p_price ELSE NULL END,
    'open'
  )
  ON CONFLICT (profile_id, market_id)
  DO UPDATE
  SET
    yes_units = CASE
      WHEN p_side = 'yes' THEN public.positions.yes_units + excluded.yes_units
      ELSE public.positions.yes_units
    END,
    no_units = CASE
      WHEN p_side = 'no' THEN public.positions.no_units + excluded.no_units
      ELSE public.positions.no_units
    END,
    avg_yes_price = CASE
      WHEN p_side = 'yes' THEN
        (
          (coalesce(public.positions.avg_yes_price, 0) * public.positions.yes_units) +
          (excluded.avg_yes_price * excluded.yes_units)
        ) / nullif(public.positions.yes_units + excluded.yes_units, 0)
      ELSE public.positions.avg_yes_price
    END,
    avg_no_price = CASE
      WHEN p_side = 'no' THEN
        (
          (coalesce(public.positions.avg_no_price, 0) * public.positions.no_units) +
          (excluded.avg_no_price * excluded.no_units)
        ) / nullif(public.positions.no_units + excluded.no_units, 0)
      ELSE public.positions.avg_no_price
    END,
    status = 'open';

  IF v_market.duration_minutes IS NOT NULL THEN
    INSERT INTO public.predictions (
      trade_id,
      profile_id,
      market_id,
      direction,
      entry_price,
      round_open_price,
      entry_time,
      time_remaining_seconds,
      reward_multiplier,
      prediction_locked
    )
    VALUES (
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
  END IF;

  IF coalesce(p_fee_amount, 0) > 0 THEN
    PERFORM public.debit_wallet(
      p_profile_id,
      p_fee_amount,
      'fee_debit',
      'trades',
      v_trade_id,
      'USD',
      'Platform fee'
    );

    PERFORM public.credit_platform_wallet(
      p_fee_amount,
      'fee_credit',
      'trades',
      v_trade_id,
      'USDT',
      'Platform fee collected'
    );
  END IF;

  SELECT p.referred_by_promoter_id
    INTO v_promoter_id
  FROM public.profiles p
  WHERE p.id = p_profile_id;

  IF v_promoter_id IS NOT NULL AND coalesce(p_fee_amount, 0) > 0 THEN
    SELECT commission_rate
      INTO v_promoter_rate
    FROM public.promoters
    WHERE id = v_promoter_id
      AND status = 'active';

    IF v_promoter_rate IS NOT NULL THEN
      v_commission_amount := round((p_fee_amount * v_promoter_rate)::numeric, 8);

      INSERT INTO public.commissions (
        promoter_id,
        referred_profile_id,
        trade_id,
        fee_amount_source,
        commission_rate,
        commission_amount,
        status
      )
      VALUES (
        v_promoter_id,
        p_profile_id,
        v_trade_id,
        p_fee_amount,
        v_promoter_rate,
        v_commission_amount,
        'pending'
      );

      UPDATE public.promoters
      SET total_commission_generated = total_commission_generated + v_commission_amount
      WHERE id = v_promoter_id;
    END IF;
  END IF;

  RETURN v_trade_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_market(
  p_market_id uuid,
  p_resolution market_outcome,
  p_admin_profile_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_market public.markets%rowtype;
  v_position record;
  v_payout numeric(20,8);
  v_round_result text;
BEGIN
  IF p_resolution NOT IN ('yes', 'no', 'cancelled') THEN
    RAISE EXCEPTION 'resolution must be yes, no, or cancelled';
  END IF;

  SELECT *
    INTO v_market
  FROM public.markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'market not found';
  END IF;

  IF v_market.status IN ('settled', 'cancelled') THEN
    RAISE EXCEPTION 'market already finalized';
  END IF;

  v_round_result := coalesce(
    v_market.round_result,
    CASE
      WHEN p_resolution = 'yes' THEN 'up'
      WHEN p_resolution = 'no' THEN 'down'
      ELSE 'flat'
    END
  );

  UPDATE public.markets
  SET status = CASE WHEN p_resolution = 'cancelled' THEN 'cancelled'::market_status ELSE 'settled'::market_status END,
      resolution_outcome = p_resolution,
      resolution_notes = p_notes,
      resolved_by = p_admin_profile_id,
      resolved_at = now()
  WHERE id = p_market_id;

  FOR v_position IN
    SELECT *
    FROM public.positions
    WHERE market_id = p_market_id
      AND status = 'open'
  LOOP
    IF p_resolution = 'yes' THEN
      v_payout := v_position.yes_units;
    ELSIF p_resolution = 'no' THEN
      v_payout := v_position.no_units;
    ELSE
      v_payout := coalesce(v_position.yes_units * v_position.avg_yes_price, 0)
        + coalesce(v_position.no_units * v_position.avg_no_price, 0);
    END IF;

    IF v_payout > 0 THEN
      PERFORM public.credit_wallet(
        v_position.profile_id,
        v_payout,
        'settlement_credit',
        'markets',
        p_market_id,
        'USD',
        CASE
          WHEN p_resolution = 'cancelled' THEN 'Market settlement refund'
          ELSE 'Market settlement payout'
        END
      );
    END IF;

    UPDATE public.positions
    SET status = CASE WHEN p_resolution = 'cancelled' THEN 'cancelled'::position_status ELSE 'settled'::position_status END,
        pnl_amount = CASE
          WHEN p_resolution = 'cancelled' THEN 0
          ELSE v_payout
        END
    WHERE id = v_position.id;
  END LOOP;

  UPDATE public.trades
  SET status = CASE WHEN p_resolution = 'cancelled' THEN 'cancelled'::trade_status ELSE 'settled'::trade_status END,
      settled_at = now()
  WHERE market_id = p_market_id
    AND status = 'executed'::trade_status;

  UPDATE public.predictions p
  SET settled = true,
      points_awarded = CASE
        WHEN v_round_result = 'flat' THEN 0
        WHEN p.direction = v_round_result THEN round((t.amount * p.reward_multiplier)::numeric, 8)
        ELSE 0
      END,
      outcome = v_round_result,
      settled_at = now()
  FROM public.trades t
  WHERE p.trade_id = t.id
    AND p.market_id = p_market_id
    AND p.settled = false;

  INSERT INTO public.admin_logs (
    admin_profile_id,
    action_type,
    target_table,
    target_id,
    notes
  )
  VALUES (
    p_admin_profile_id,
    'market_settled',
    'markets',
    p_market_id,
    p_notes
  );
END;
$$;
