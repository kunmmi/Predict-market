-- Fix place_multi_trade: insert NULL for no_units/avg_no_price instead of 0.
--
-- The positions table has a check constraint (chk_positions_avg_no_range) that
-- requires avg_no_price to be > 0 when set, because binary markets always have
-- a non-zero no-price.  Multi-outcome (WC) markets have no "no" side at all, so
-- inserting 0 violates the constraint.  The correct value is NULL.

CREATE OR REPLACE FUNCTION public.place_multi_trade(
  p_profile_id  uuid,
  p_market_id   uuid,
  p_outcome_id  uuid,
  p_amount      numeric,
  p_fee_amount  numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id          uuid;
  v_available_balance  numeric;
  v_balance_before     numeric;
  v_total_debit        numeric;
  v_market_status      text;
  v_market_type        text;
  v_outcome_market_id  uuid;
  v_position_id        uuid;
  v_price_at_trade     numeric;
  v_total_pool         numeric;
BEGIN
  -- Validate amounts
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero.';
  END IF;
  IF p_fee_amount < 0 THEN
    RAISE EXCEPTION 'Fee amount cannot be negative.';
  END IF;

  v_total_debit := p_amount + p_fee_amount;

  -- Lock and validate market
  SELECT status, market_type
    INTO v_market_status, v_market_type
    FROM public.markets
   WHERE id = p_market_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found.';
  END IF;
  IF v_market_type <> 'multi' THEN
    RAISE EXCEPTION 'Market is not a multi-outcome market.';
  END IF;
  IF v_market_status <> 'active' THEN
    RAISE EXCEPTION 'Market is not accepting trades.';
  END IF;

  -- Validate outcome belongs to this market
  SELECT market_id
    INTO v_outcome_market_id
    FROM public.market_outcomes
   WHERE id = p_outcome_id;

  IF NOT FOUND OR v_outcome_market_id <> p_market_id THEN
    RAISE EXCEPTION 'Outcome does not belong to this market.';
  END IF;

  -- Lock wallet and check balance
  SELECT id, available_balance, balance
    INTO v_wallet_id, v_available_balance, v_balance_before
    FROM public.wallets
   WHERE profile_id = p_profile_id
     AND status = 'active'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found or inactive.';
  END IF;
  IF v_available_balance < v_total_debit THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, required: %',
      v_available_balance, v_total_debit;
  END IF;

  -- Debit wallet
  UPDATE public.wallets
     SET available_balance = available_balance - v_total_debit,
         balance           = balance           - v_total_debit,
         updated_at        = now()
   WHERE id = v_wallet_id;

  -- Record trade debit transaction
  INSERT INTO public.wallet_transactions (
    wallet_id, profile_id, transaction_type, reference_table, reference_id,
    asset_symbol, amount, direction, balance_before, balance_after, description
  ) VALUES (
    v_wallet_id, p_profile_id, 'trade_debit', 'market_outcomes', p_outcome_id,
    'USDT', p_amount, 'debit',
    v_balance_before, v_balance_before - p_amount,
    'Multi-outcome trade stake'
  );

  -- Record fee debit (if any)
  IF p_fee_amount > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, profile_id, transaction_type, reference_table, reference_id,
      asset_symbol, amount, direction, balance_before, balance_after, description
    ) VALUES (
      v_wallet_id, p_profile_id, 'fee_debit', 'market_outcomes', p_outcome_id,
      'USDT', p_fee_amount, 'debit',
      v_balance_before - p_amount, v_balance_before - v_total_debit,
      'Multi-outcome trade fee'
    );
  END IF;

  -- Calculate current implied price for this outcome (parimutuel)
  SELECT COALESCE(SUM(pool_amount), 0)
    INTO v_total_pool
    FROM public.market_outcomes
   WHERE market_id = p_market_id;

  -- Price = this_pool / (total_pool + amount); handle zero-pool case
  IF v_total_pool + p_amount > 0 THEN
    SELECT ROUND(
      (pool_amount + p_amount) / (v_total_pool + p_amount), 4
    )
      INTO v_price_at_trade
      FROM public.market_outcomes
     WHERE id = p_outcome_id;
  ELSE
    SELECT ROUND(1.0 / NULLIF(
      (SELECT COUNT(*) FROM public.market_outcomes WHERE market_id = p_market_id), 0
    ), 4)
      INTO v_price_at_trade;
  END IF;

  -- Update outcome pool
  UPDATE public.market_outcomes
     SET pool_amount = pool_amount + p_amount,
         updated_at  = now()
   WHERE id = p_outcome_id;

  -- Recalculate all outcome prices (parimutuel)
  WITH new_total AS (
    SELECT SUM(pool_amount) AS total FROM public.market_outcomes WHERE market_id = p_market_id
  )
  UPDATE public.market_outcomes mo
     SET price = CASE
           WHEN nt.total > 0 THEN ROUND(mo.pool_amount / nt.total, 4)
           ELSE ROUND(1.0 / NULLIF((SELECT COUNT(*) FROM public.market_outcomes WHERE market_id = p_market_id), 0), 4)
         END,
         updated_at = now()
    FROM new_total nt
   WHERE mo.market_id = p_market_id;

  -- Create or update position
  -- yes_units stores the stake; outcome_id identifies which outcome
  -- no_units and avg_no_price are NULL for multi-outcome markets (no "no" side)
  SELECT id INTO v_position_id
    FROM public.positions
   WHERE profile_id  = p_profile_id
     AND market_id   = p_market_id
     AND outcome_id  = p_outcome_id
     AND status      = 'open'
     FOR UPDATE;

  IF FOUND THEN
    -- Add to existing position (average in price)
    UPDATE public.positions
       SET yes_units     = yes_units + p_amount,
           avg_yes_price = ROUND(
             (avg_yes_price * yes_units + v_price_at_trade * p_amount) / (yes_units + p_amount), 4
           ),
           updated_at    = now()
     WHERE id = v_position_id;
  ELSE
    INSERT INTO public.positions (
      profile_id, market_id, outcome_id,
      yes_units, no_units, avg_yes_price, avg_no_price,
      status
    ) VALUES (
      p_profile_id, p_market_id, p_outcome_id,
      p_amount, 0, v_price_at_trade, NULL,
      'open'
    )
    RETURNING id INTO v_position_id;
  END IF;

  RETURN v_position_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_multi_trade TO authenticated;
