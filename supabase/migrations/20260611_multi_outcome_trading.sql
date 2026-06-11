-- Multi-outcome trading RPCs
-- Two atomic functions:
--   place_multi_trade   — debit wallet, record position, update outcome pool
--   settle_multi_market — mark winner, pay out winning positions pro-rata

-- ── 1. place_multi_trade ────────────────────────────────────────────────────
--
-- Parameters:
--   p_profile_id  — the trading user
--   p_market_id   — must be market_type = 'multi' and status = 'active'
--   p_outcome_id  — the specific outcome being backed
--   p_amount      — stake in USD (stored as yes_units on the position)
--   p_fee_amount  — platform fee (debited separately)
--
-- Returns: position id (uuid)

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
      p_amount, 0, v_price_at_trade, 0,
      'open'
    )
    RETURNING id INTO v_position_id;
  END IF;

  RETURN v_position_id;
END;
$$;

-- ── 2. settle_multi_market ──────────────────────────────────────────────────
--
-- Parameters:
--   p_market_id         — the multi market to settle
--   p_winner_outcome_id — the outcome that won
--   p_admin_profile_id  — admin performing settlement
--   p_notes             — optional resolution notes
--   p_fee_rate          — platform take from winnings (default 5%)

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
  v_market_type   text;
  v_market_status text;
  v_total_pool    numeric;
  v_winner_pool   numeric;
  v_pos           RECORD;
  v_payout        numeric;
  v_net_pnl       numeric;
  v_wallet_id     uuid;
  v_balance_before numeric;
BEGIN
  -- Validate market
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
  IF v_market_status NOT IN ('active', 'closed') THEN
    RAISE EXCEPTION 'Market cannot be settled (status: %).', v_market_status;
  END IF;

  -- Validate winner outcome belongs to this market
  IF NOT EXISTS (
    SELECT 1 FROM public.market_outcomes
     WHERE id = p_winner_outcome_id AND market_id = p_market_id
  ) THEN
    RAISE EXCEPTION 'Winner outcome does not belong to this market.';
  END IF;

  -- Calculate pool totals
  SELECT COALESCE(SUM(pool_amount), 0)
    INTO v_total_pool
    FROM public.market_outcomes
   WHERE market_id = p_market_id;

  SELECT COALESCE(SUM(yes_units), 0)
    INTO v_winner_pool
    FROM public.positions
   WHERE market_id  = p_market_id
     AND outcome_id = p_winner_outcome_id
     AND status     = 'open';

  -- Mark outcome winners/losers
  UPDATE public.market_outcomes
     SET is_winner  = (id = p_winner_outcome_id),
         updated_at = now()
   WHERE market_id  = p_market_id;

  -- Settle all positions
  FOR v_pos IN
    SELECT p.id, p.profile_id, p.yes_units, p.outcome_id
      FROM public.positions p
     WHERE p.market_id = p_market_id
       AND p.status    = 'open'
     FOR UPDATE
  LOOP
    IF v_pos.outcome_id = p_winner_outcome_id AND v_winner_pool > 0 THEN
      -- Winning position: pro-rata share of total pool minus fee
      v_payout  := ROUND((v_pos.yes_units / v_winner_pool) * v_total_pool * (1 - p_fee_rate), 6);
      v_net_pnl := ROUND(v_payout - v_pos.yes_units, 6);

      -- Credit wallet
      SELECT id, balance INTO v_wallet_id, v_balance_before
        FROM public.wallets
       WHERE profile_id = v_pos.profile_id AND status = 'active'
         FOR UPDATE;

      IF FOUND THEN
        UPDATE public.wallets
           SET balance           = balance           + v_payout,
               available_balance = available_balance + v_payout,
               updated_at        = now()
         WHERE id = v_wallet_id;

        INSERT INTO public.wallet_transactions (
          wallet_id, profile_id, transaction_type, reference_table, reference_id,
          asset_symbol, amount, direction, balance_before, balance_after, description
        ) VALUES (
          v_wallet_id, v_pos.profile_id, 'settlement_credit', 'positions', v_pos.id,
          'USDT', v_payout, 'credit',
          v_balance_before, v_balance_before + v_payout,
          'Multi-outcome settlement payout'
        );
      END IF;
    ELSE
      -- Losing position
      v_payout  := 0;
      v_net_pnl := -v_pos.yes_units;
    END IF;

    -- Settle position
    UPDATE public.positions
       SET status     = 'settled',
           pnl_amount = v_payout,
           updated_at = now()
     WHERE id = v_pos.id;
  END LOOP;

  -- Settle the market itself
  UPDATE public.markets
     SET status             = 'settled',
         resolution_outcome = 'yes',  -- 'yes' signals "resolved" for multi markets
         resolution_notes   = p_notes,
         resolved_by        = p_admin_profile_id,
         resolved_at        = now(),
         updated_at         = now()
   WHERE id = p_market_id;

END;
$$;

-- Grant execute to authenticated users (place_multi_trade checks auth in caller)
GRANT EXECUTE ON FUNCTION public.place_multi_trade TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_multi_market TO authenticated;
