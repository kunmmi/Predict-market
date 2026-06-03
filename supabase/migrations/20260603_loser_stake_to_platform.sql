-- Migration: route losing stakes to the platform wallet
--
-- Previously, when a position was on the losing side (v_payout = 0),
-- the staked amount was simply discarded. It now flows to the platform wallet
-- alongside the existing 10% fee on winners.
--
-- Accounting per position (non-cancelled):
--   Winning side (yes_units if resolution='yes', no_units if resolution='no'):
--     → 90% to user, 10% fee to platform wallet  (unchanged)
--   Losing side (no_units * avg_no_price if resolution='yes', etc.):
--     → 100% to platform wallet                  (NEW)
--
-- A position can theoretically hold both YES and NO units (hedged trade),
-- so both sides are evaluated independently every loop iteration.

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
  v_market        public.markets%rowtype;
  v_position      record;
  v_payout        numeric(20,8);
  v_loser_stake   numeric(20,8);
  v_fee           numeric(20,8);
  v_net_payout    numeric(20,8);
  v_round_result  text;
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
      WHEN p_resolution = 'yes'       THEN 'up'
      WHEN p_resolution = 'no'        THEN 'down'
      ELSE 'flat'
    END
  );

  UPDATE public.markets
  SET status             = CASE WHEN p_resolution = 'cancelled' THEN 'cancelled'::market_status ELSE 'settled'::market_status END,
      resolution_outcome = p_resolution,
      resolution_notes   = p_notes,
      resolved_by        = p_admin_profile_id,
      resolved_at        = now()
  WHERE id = p_market_id;

  FOR v_position IN
    SELECT *
    FROM public.positions
    WHERE market_id = p_market_id
      AND status    = 'open'
  LOOP

    -- ── Determine winning payout and losing stake for this position ──────
    IF p_resolution = 'yes' THEN
      v_payout      := coalesce(v_position.yes_units, 0);
      v_loser_stake := round(coalesce(v_position.no_units  * v_position.avg_no_price,  0), 8);
    ELSIF p_resolution = 'no' THEN
      v_payout      := coalesce(v_position.no_units, 0);
      v_loser_stake := round(coalesce(v_position.yes_units * v_position.avg_yes_price, 0), 8);
    ELSE
      -- cancelled → full refund of both sides, no loser stake
      v_payout      := coalesce(v_position.yes_units * v_position.avg_yes_price, 0)
                     + coalesce(v_position.no_units  * v_position.avg_no_price,  0);
      v_loser_stake := 0;
    END IF;

    -- ── Pay the winning side ─────────────────────────────────────────────
    IF v_payout > 0 THEN
      IF p_resolution = 'cancelled' THEN
        -- Full refund — no fee.
        PERFORM public.credit_wallet(
          v_position.profile_id,
          v_payout,
          'settlement_credit',
          'markets',
          p_market_id,
          'USD',
          'Market settlement refund'
        );
        v_net_payout := v_payout;
      ELSE
        -- 10% platform fee on gross winnings.
        v_fee        := round(v_payout * 0.10, 8);
        v_net_payout := v_payout - v_fee;

        PERFORM public.credit_wallet(
          v_position.profile_id,
          v_net_payout,
          'settlement_credit',
          'markets',
          p_market_id,
          'USD',
          'Market settlement payout'
        );

        PERFORM public.credit_platform_wallet(
          v_fee,
          'fee_credit',
          'markets',
          p_market_id,
          'USD',
          'Settlement fee (10% of winnings)'
        );
      END IF;
    ELSE
      v_net_payout := 0;
    END IF;

    -- ── Route loser stake to platform wallet ─────────────────────────────
    IF v_loser_stake > 0 THEN
      PERFORM public.credit_platform_wallet(
        v_loser_stake,
        'fee_credit',
        'markets',
        p_market_id,
        'USD',
        'Loser stake absorbed by platform'
      );
    END IF;

    UPDATE public.positions
    SET status     = CASE WHEN p_resolution = 'cancelled' THEN 'cancelled'::position_status ELSE 'settled'::position_status END,
        pnl_amount = CASE
          WHEN p_resolution = 'cancelled' THEN 0
          ELSE v_net_payout
        END
    WHERE id = v_position.id;

  END LOOP;

  UPDATE public.trades
  SET status     = CASE WHEN p_resolution = 'cancelled' THEN 'cancelled'::trade_status ELSE 'settled'::trade_status END,
      settled_at = now()
  WHERE market_id = p_market_id
    AND status    = 'executed'::trade_status;

  UPDATE public.predictions p
  SET settled        = true,
      points_awarded = CASE
        WHEN v_round_result = 'flat' THEN 0
        WHEN p.direction = v_round_result THEN round((t.amount * p.reward_multiplier)::numeric, 8)
        ELSE 0
      END,
      outcome    = v_round_result,
      settled_at = now()
  FROM public.trades t
  WHERE p.trade_id   = t.id
    AND p.market_id  = p_market_id
    AND p.settled    = false;

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
