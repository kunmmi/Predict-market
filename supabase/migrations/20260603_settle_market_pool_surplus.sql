-- Migration: Capture orphaned pool surplus at market settlement
--
-- Problem: when a user sells their position before settlement and no one
-- buys it from the pool, the USDT they originally staked stays in the
-- market pool but is never attributed to anyone. The old settle_market
-- only looped over *active* positions, so sold-out stakes were silently
-- left uncollected.
--
-- Fix: after the winners loop, compute:
--
--   surplus = total_trade_debits_into_market
--           − early_sell_credits_returned_to_users
--           − settlement_credits_paid_to_winners
--           − fees_already_credited_to_platform_wallet
--
-- Any positive surplus (> $0.001 to avoid dust) is credited to the
-- platform wallet. For a healthy balanced market this rounds to ~$0,
-- because winners are paid from losers' stakes. For a market with
-- early exits or no participants on one side, the orphaned stake is
-- correctly captured.

CREATE OR REPLACE FUNCTION public.settle_market(
  p_market_id        uuid,
  p_resolution       market_outcome,
  p_admin_profile_id uuid,
  p_notes            text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_market                    public.markets%rowtype;
  v_position                  record;
  v_payout                    numeric(20,8);
  v_fee                       numeric(20,8);
  v_net_payout                numeric(20,8);
  v_round_result              text;

  -- Pool-surplus vars
  v_total_trade_debits        numeric(20,8);
  v_total_early_sell_returns  numeric(20,8);
  v_total_settlement_credits  numeric(20,8);
  v_total_fees_credited       numeric(20,8);
  v_pool_surplus              numeric(20,8);
BEGIN
  IF p_resolution NOT IN ('yes', 'no', 'cancelled') THEN
    RAISE EXCEPTION 'resolution must be yes, no, or cancelled';
  END IF;

  SELECT * INTO v_market
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
      WHEN p_resolution = 'no'  THEN 'down'
      ELSE 'flat'
    END
  );

  UPDATE public.markets
  SET status             = CASE WHEN p_resolution = 'cancelled'
                                THEN 'cancelled'::market_status
                                ELSE 'settled'::market_status END,
      resolution_outcome = p_resolution,
      resolution_notes   = p_notes,
      resolved_by        = p_admin_profile_id,
      resolved_at        = now()
  WHERE id = p_market_id;

  -- ── Pay out winners ────────────────────────────────────────────────────
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
      -- Cancelled: refund full stake
      v_payout := coalesce(v_position.yes_units * v_position.avg_yes_price, 0)
                + coalesce(v_position.no_units  * v_position.avg_no_price,  0);
    END IF;

    IF v_payout > 0 THEN
      IF p_resolution = 'cancelled' THEN
        PERFORM public.credit_wallet(
          v_position.profile_id, v_payout,
          'settlement_credit', 'markets', p_market_id, 'USD',
          'Market settlement refund'
        );
        v_net_payout := v_payout;
      ELSE
        v_fee        := round(v_payout * 0.10, 8);
        v_net_payout := v_payout - v_fee;

        PERFORM public.credit_wallet(
          v_position.profile_id, v_net_payout,
          'settlement_credit', 'markets', p_market_id, 'USD',
          'Market settlement payout'
        );

        PERFORM public.credit_platform_wallet(
          v_fee, 'fee_credit', 'markets', p_market_id, 'USD',
          'Settlement fee (10% of winnings)'
        );
      END IF;
    ELSE
      v_net_payout := 0;
    END IF;

    UPDATE public.positions
    SET status     = CASE WHEN p_resolution = 'cancelled'
                          THEN 'cancelled'::position_status
                          ELSE 'settled'::position_status END,
        pnl_amount = CASE WHEN p_resolution = 'cancelled' THEN 0 ELSE v_net_payout END
    WHERE id = v_position.id;
  END LOOP;

  -- ── Capture orphaned pool surplus (non-cancelled markets only) ─────────
  -- Any USDT that entered the market pool but wasn't returned to users or
  -- paid to winners is platform profit (e.g. early exits with no buyers).
  IF p_resolution != 'cancelled' THEN

    -- Money that entered the market (buy trades)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_trade_debits
    FROM public.wallet_transactions
    WHERE reference_table = 'markets'
      AND reference_id    = p_market_id
      AND transaction_type = 'trade_debit';

    -- Money returned early via position sells before settlement
    SELECT COALESCE(SUM(wt.amount), 0) INTO v_total_early_sell_returns
    FROM public.wallet_transactions wt
    JOIN public.trades t ON t.id = wt.reference_id
    WHERE t.market_id            = p_market_id
      AND wt.transaction_type    = 'trade_credit';

    -- Money paid to winners in this settlement (just credited above)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_settlement_credits
    FROM public.wallet_transactions
    WHERE reference_table = 'markets'
      AND reference_id    = p_market_id
      AND transaction_type = 'settlement_credit';

    -- Fees already credited to platform (trade fees + settlement fees above)
    SELECT COALESCE(SUM(pwt.amount), 0) INTO v_total_fees_credited
    FROM public.platform_wallet_transactions pwt
    WHERE (pwt.reference_table = 'markets' AND pwt.reference_id = p_market_id)
       OR (pwt.reference_table = 'trades'  AND pwt.reference_id IN (
             SELECT id FROM public.trades WHERE market_id = p_market_id
           ));

    v_pool_surplus := v_total_trade_debits
                    - v_total_early_sell_returns
                    - v_total_settlement_credits
                    - v_total_fees_credited;

    IF v_pool_surplus > 0.001 THEN
      PERFORM public.credit_platform_wallet(
        v_pool_surplus,
        'fee_credit',
        'markets',
        p_market_id,
        'USD',
        'Pool surplus: unclaimed stakes after settlement (early exits / no opposing side)'
      );
    END IF;

  END IF;

  -- ── Update trade + prediction statuses ────────────────────────────────
  UPDATE public.trades
  SET status     = CASE WHEN p_resolution = 'cancelled'
                        THEN 'cancelled'::trade_status
                        ELSE 'settled'::trade_status END,
      settled_at = now()
  WHERE market_id = p_market_id
    AND status    = 'executed'::trade_status;

  UPDATE public.predictions p
  SET settled        = true,
      points_awarded = CASE
        WHEN v_round_result = 'flat' THEN 0
        WHEN p.direction = v_round_result
          THEN round((t.amount * p.reward_multiplier)::numeric, 8)
        ELSE 0
      END,
      outcome    = v_round_result,
      settled_at = now()
  FROM public.trades t
  WHERE p.trade_id    = t.id
    AND p.market_id   = p_market_id
    AND p.settled     = false;

  INSERT INTO public.admin_logs (
    admin_profile_id, action_type, target_table, target_id, notes
  ) VALUES (
    p_admin_profile_id, 'market_settled', 'markets', p_market_id, p_notes
  );
END;
$$;

-- ── One-time fix: credit the orphaned surplus from the already-settled ──
-- market 0b987ce7-cc7e-48c8-899c-11deda75bac9 (ETH 5-min, 2026-06-03).
-- User deposited $4.99, bought YES for $1, sold back for $0.06, withdrew
-- $4. The $0.9212 pool surplus was never captured at settlement.
-- ($1.00 in − $0.0588 returned − $0.02 fee already credited = $0.9212)
DO $$
DECLARE
  v_market_id  uuid := '0b987ce7-cc7e-48c8-899c-11deda75bac9';
  v_already    numeric;
BEGIN
  -- Guard: only run if surplus wasn't already credited for this market
  SELECT COALESCE(SUM(amount), 0) INTO v_already
  FROM public.platform_wallet_transactions
  WHERE reference_table = 'markets'
    AND reference_id    = v_market_id
    AND description LIKE '%Pool surplus%';

  IF v_already < 0.001 THEN
    PERFORM public.credit_platform_wallet(
      0.9212,
      'fee_credit',
      'markets',
      v_market_id,
      'USD',
      'Pool surplus: unclaimed stakes after settlement (early exits / no opposing side) [backfill]'
    );
    RAISE NOTICE 'Backfill: credited $0.9212 pool surplus for market %', v_market_id;
  ELSE
    RAISE NOTICE 'Backfill already applied, skipping.';
  END IF;
END $$;
