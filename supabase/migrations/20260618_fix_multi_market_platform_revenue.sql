-- WC multi-outcome markets: house model
--
-- All player stakes flow immediately to the platform wallet.
-- pool_amount on market_outcomes tracks bet sizes for odds display only.
-- At settlement:
--   - Winners: paid from platform wallet pro-rata (total_pool / winner_pool * their_stake)
--   - Losers:  nothing — their money is already in the platform wallet
--   - Platform keeps: all loser stakes + 5% fee on winner payouts

-- ── 1. place_multi_trade ─────────────────────────────────────────────────────

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
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero.'; END IF;
  IF p_fee_amount < 0 THEN RAISE EXCEPTION 'Fee amount cannot be negative.'; END IF;

  v_total_debit := p_amount + p_fee_amount;

  SELECT status, market_type INTO v_market_status, v_market_type
    FROM public.markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Market not found.'; END IF;
  IF v_market_type <> 'multi' THEN RAISE EXCEPTION 'Market is not a multi-outcome market.'; END IF;
  IF v_market_status <> 'active' THEN RAISE EXCEPTION 'Market is not accepting trades.'; END IF;

  SELECT market_id INTO v_outcome_market_id
    FROM public.market_outcomes WHERE id = p_outcome_id;
  IF NOT FOUND OR v_outcome_market_id <> p_market_id THEN
    RAISE EXCEPTION 'Outcome does not belong to this market.';
  END IF;

  SELECT id, available_balance, balance
    INTO v_wallet_id, v_available_balance, v_balance_before
    FROM public.wallets WHERE profile_id = p_profile_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found or inactive.'; END IF;
  IF v_available_balance < v_total_debit THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, required: %', v_available_balance, v_total_debit;
  END IF;

  -- Debit player wallet (stake + fee)
  UPDATE public.wallets
     SET available_balance = available_balance - v_total_debit,
         balance           = balance           - v_total_debit,
         updated_at        = now()
   WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, profile_id, transaction_type, reference_table, reference_id,
    asset_symbol, amount, direction, balance_before, balance_after, description
  ) VALUES (
    v_wallet_id, p_profile_id, 'trade_debit', 'market_outcomes', p_outcome_id,
    'USDT', p_amount, 'debit', v_balance_before, v_balance_before - p_amount,
    'Multi-outcome trade stake'
  );

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

  -- Entire player payment (stake + fee) goes to platform wallet immediately
  PERFORM public.credit_platform_wallet(
    v_total_debit,
    'fee_credit',
    'market_outcomes',
    p_outcome_id,
    'USDT',
    'WC stake received (house model)'
  );

  -- Track pool_amount for odds display only (not real money movement)
  SELECT COALESCE(SUM(pool_amount), 0) INTO v_total_pool
    FROM public.market_outcomes WHERE market_id = p_market_id;

  IF v_total_pool + p_amount > 0 THEN
    SELECT ROUND((pool_amount + p_amount) / (v_total_pool + p_amount), 4)
      INTO v_price_at_trade FROM public.market_outcomes WHERE id = p_outcome_id;
  ELSE
    SELECT ROUND(1.0 / NULLIF(
      (SELECT COUNT(*) FROM public.market_outcomes WHERE market_id = p_market_id), 0
    ), 4) INTO v_price_at_trade;
  END IF;

  UPDATE public.market_outcomes
     SET pool_amount = pool_amount + p_amount, updated_at = now()
   WHERE id = p_outcome_id;

  WITH new_total AS (
    SELECT SUM(pool_amount) AS total FROM public.market_outcomes WHERE market_id = p_market_id
  )
  UPDATE public.market_outcomes mo
     SET price = CASE
           WHEN nt.total > 0 THEN ROUND(mo.pool_amount / nt.total, 4)
           ELSE ROUND(1.0 / NULLIF((SELECT COUNT(*) FROM public.market_outcomes WHERE market_id = p_market_id), 0), 4)
         END,
         updated_at = now()
    FROM new_total nt WHERE mo.market_id = p_market_id;

  -- Create or update position
  SELECT id INTO v_position_id
    FROM public.positions
   WHERE profile_id = p_profile_id AND market_id = p_market_id
     AND outcome_id = p_outcome_id AND status = 'open'
     FOR UPDATE;

  IF FOUND THEN
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
      yes_units, no_units, avg_yes_price, avg_no_price, status
    ) VALUES (
      p_profile_id, p_market_id, p_outcome_id,
      p_amount, 0, v_price_at_trade, NULL, 'open'
    )
    RETURNING id INTO v_position_id;
  END IF;

  RETURN v_position_id;
END;
$$;

-- ── 2. settle_multi_market ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.settle_multi_market(
  p_market_id          uuid,
  p_winner_outcome_id  uuid,
  p_admin_profile_id   uuid,
  p_notes              text    DEFAULT NULL,
  p_fee_rate           numeric DEFAULT 0.05
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner_pool    numeric;
  v_total_pool     numeric;
  v_pos            record;
  v_balance_before numeric;
  v_payout         numeric;
  v_net_pnl        numeric;
BEGIN
  PERFORM 1 FROM public.markets
   WHERE id = p_market_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Market not found or not active.'; END IF;

  PERFORM 1 FROM public.market_outcomes
   WHERE id = p_winner_outcome_id AND market_id = p_market_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Winner outcome does not belong to this market.'; END IF;

  SELECT COALESCE(SUM(pool_amount), 0) INTO v_total_pool
    FROM public.market_outcomes WHERE market_id = p_market_id;

  SELECT COALESCE(SUM(yes_units), 0) INTO v_winner_pool
    FROM public.positions
   WHERE market_id = p_market_id AND outcome_id = p_winner_outcome_id AND status = 'open';

  UPDATE public.market_outcomes
     SET is_winner = (id = p_winner_outcome_id), updated_at = now()
   WHERE market_id = p_market_id;

  FOR v_pos IN
    SELECT p.id, p.profile_id, p.outcome_id, p.yes_units
      FROM public.positions p
     WHERE p.market_id = p_market_id AND p.status = 'open'
     FOR UPDATE
  LOOP
    IF v_pos.outcome_id = p_winner_outcome_id AND v_winner_pool > 0 THEN
      -- Winner payout: pro-rata share of total pool minus 5% fee
      v_payout  := ROUND((v_pos.yes_units / v_winner_pool) * v_total_pool * (1 - p_fee_rate), 6);
      v_net_pnl := ROUND(v_payout - v_pos.yes_units, 6);

      -- Pay winner from platform wallet
      PERFORM public.debit_platform_wallet(
        v_payout,
        'payout_debit',
        'positions',
        v_pos.id,
        'USDT',
        'WC winner payout (house model)'
      );

      -- Credit winner''s in-app wallet
      PERFORM public.credit_wallet(
        v_pos.profile_id,
        v_payout,
        'settlement_credit',
        'positions',
        v_pos.id,
        'USDT',
        'WC market win payout'
      );

    ELSE
      -- Loser: money already in platform wallet from trade time, nothing to do
      v_payout  := 0;
      v_net_pnl := -v_pos.yes_units;
    END IF;

    UPDATE public.positions
       SET status = 'settled', pnl_amount = v_payout, updated_at = now()
     WHERE id = v_pos.id;
  END LOOP;

  UPDATE public.markets
     SET status             = 'settled',
         resolution_outcome = 'yes',
         resolution_notes   = p_notes,
         resolved_by        = p_admin_profile_id,
         resolved_at        = now(),
         updated_at         = now()
   WHERE id = p_market_id;

  INSERT INTO public.admin_logs (admin_profile_id, action_type, target_table, target_id, notes)
  VALUES (p_admin_profile_id, 'market_settled', 'markets', p_market_id, p_notes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_multi_trade TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_multi_market TO authenticated;
