-- Craps casino game
-- Adds game_debit/game_credit wallet tx types, craps_rounds audit table,
-- and resolve_craps_round RPC that rolls dice + debits/credits atomically.

-- 1. New wallet transaction types
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'game_debit';
ALTER TYPE public.wallet_tx_type ADD VALUE IF NOT EXISTS 'game_credit';

-- 2. Round log (audit trail — one row per dice roll)
CREATE TABLE IF NOT EXISTS public.craps_rounds (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phase         text        NOT NULL CHECK (phase IN ('come_out', 'point')),
  point_number  int         CHECK (point_number IN (4, 5, 6, 8, 9, 10)),
  die1          int         NOT NULL CHECK (die1 BETWEEN 1 AND 6),
  die2          int         NOT NULL CHECK (die2 BETWEEN 1 AND 6),
  total         int         NOT NULL CHECK (total BETWEEN 2 AND 12),
  outcome       text        NOT NULL CHECK (outcome IN ('win','loss','push','point_set','point_hit','seven_out','continue')),
  bets          jsonb       NOT NULL,
  gross_payout  numeric(20,8) NOT NULL DEFAULT 0,
  fee_amount    numeric(20,8) NOT NULL DEFAULT 0,
  net_payout    numeric(20,8) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.craps_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "craps_rounds_own_select"
  ON public.craps_rounds FOR SELECT
  USING (
    profile_id = (
      SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
    )
  );

-- 3. RPC: resolve_craps_round
-- Rolls two dice server-side, resolves all bets, debits/credits wallet in one transaction.
CREATE OR REPLACE FUNCTION public.resolve_craps_round(
  p_profile_id   uuid,
  p_bets         jsonb,           -- [{type:'pass_line'|'dont_pass'|'field', amount:numeric}]
  p_phase        text,            -- 'come_out' | 'point'
  p_point_number int  DEFAULT NULL,
  p_fee_rate     numeric DEFAULT 0.02
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_die1          int;
  v_die2          int;
  v_total         int;
  v_outcome       text;
  v_new_point     int    := NULL;
  v_gross_payout  numeric(20,8) := 0;
  v_fee           numeric(20,8) := 0;
  v_net_payout    numeric(20,8) := 0;
  v_total_bet     numeric(20,8) := 0;
  v_bet           jsonb;
  v_bet_type      text;
  v_bet_amount    numeric(20,8);
  v_round_id      uuid;
  v_admin_id      uuid;
BEGIN
  -- Validate phase
  IF p_phase NOT IN ('come_out', 'point') THEN
    RAISE EXCEPTION 'Invalid phase: %', p_phase;
  END IF;
  IF p_phase = 'point' AND p_point_number NOT IN (4, 5, 6, 8, 9, 10) THEN
    RAISE EXCEPTION 'Invalid point_number: %', p_point_number;
  END IF;

  -- Sum total bet
  FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets) LOOP
    v_bet_amount := (v_bet->>'amount')::numeric;
    IF v_bet_amount <= 0 THEN
      RAISE EXCEPTION 'Bet amount must be positive';
    END IF;
    v_total_bet := v_total_bet + v_bet_amount;
  END LOOP;

  IF v_total_bet <= 0 THEN
    RAISE EXCEPTION 'No bets placed';
  END IF;

  -- Debit total stake from user wallet
  PERFORM public.debit_wallet(
    p_profile_id      := p_profile_id,
    p_amount          := v_total_bet,
    p_transaction_type := 'game_debit',
    p_reference_table := 'craps_rounds',
    p_reference_id    := gen_random_uuid(),
    p_asset_symbol    := 'USDT',
    p_description     := 'Craps bet'
  );

  -- Roll dice (server-side using pg random, seeded per transaction)
  v_die1  := floor(random() * 6 + 1)::int;
  v_die2  := floor(random() * 6 + 1)::int;
  v_total := v_die1 + v_die2;

  -- Resolve outcome
  IF p_phase = 'come_out' THEN
    CASE
      WHEN v_total IN (7, 11) THEN v_outcome := 'win';
      WHEN v_total IN (2, 3)  THEN v_outcome := 'loss';
      WHEN v_total = 12       THEN v_outcome := 'push';
      ELSE
        v_outcome   := 'point_set';
        v_new_point := v_total;
    END CASE;
  ELSE -- point phase
    CASE
      WHEN v_total = p_point_number THEN v_outcome := 'point_hit';
      WHEN v_total = 7              THEN v_outcome := 'seven_out';
      ELSE                               v_outcome := 'continue';
    END CASE;
  END IF;

  -- Calculate gross payout per bet
  FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets) LOOP
    v_bet_type   := v_bet->>'type';
    v_bet_amount := (v_bet->>'amount')::numeric;

    IF v_bet_type = 'pass_line' THEN
      CASE v_outcome
        WHEN 'win',       'point_hit'  THEN v_gross_payout := v_gross_payout + (v_bet_amount * 2);
        WHEN 'loss',      'seven_out'  THEN NULL; -- stake already debited
        WHEN 'push'                    THEN v_gross_payout := v_gross_payout + v_bet_amount;
        WHEN 'point_set', 'continue'   THEN v_gross_payout := v_gross_payout + v_bet_amount; -- carry forward
        ELSE NULL;
      END CASE;

    ELSIF v_bet_type = 'dont_pass' THEN
      CASE v_outcome
        WHEN 'loss',      'seven_out'  THEN v_gross_payout := v_gross_payout + (v_bet_amount * 2);
        WHEN 'win',       'point_hit'  THEN NULL;
        WHEN 'push'                    THEN v_gross_payout := v_gross_payout + v_bet_amount; -- push = return stake
        WHEN 'point_set', 'continue'   THEN v_gross_payout := v_gross_payout + v_bet_amount;
        ELSE NULL;
      END CASE;

    ELSIF v_bet_type = 'field' THEN
      -- Field always resolves on this roll
      CASE v_total
        WHEN 2              THEN v_gross_payout := v_gross_payout + (v_bet_amount * 3);  -- 2:1 + stake
        WHEN 12             THEN v_gross_payout := v_gross_payout + (v_bet_amount * 4);  -- 3:1 + stake
        WHEN 3, 4, 9, 10, 11 THEN v_gross_payout := v_gross_payout + (v_bet_amount * 2); -- 1:1 + stake
        ELSE NULL; -- 5,6,7,8 → field loses
      END CASE;
    END IF;
  END LOOP;

  -- House fee: 2% on profit only (not on returned stakes)
  IF v_gross_payout > v_total_bet THEN
    v_fee := ROUND((v_gross_payout - v_total_bet) * p_fee_rate, 8);
  END IF;
  v_net_payout := v_gross_payout - v_fee;

  -- Credit user if they get anything back
  IF v_net_payout > 0 THEN
    PERFORM public.credit_wallet(
      p_profile_id      := p_profile_id,
      p_amount          := v_net_payout,
      p_transaction_type := 'game_credit',
      p_reference_table := 'craps_rounds',
      p_reference_id    := gen_random_uuid(),
      p_asset_symbol    := 'USDT',
      p_description     := 'Craps payout'
    );
  END IF;

  -- Credit fee to platform
  IF v_fee > 0 THEN
    SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    PERFORM public.credit_platform_wallet(
      p_amount          := v_fee,
      p_transaction_type := 'fee_credit',
      p_reference_table := 'craps_rounds',
      p_reference_id    := gen_random_uuid(),
      p_asset_symbol    := 'USDT',
      p_description     := 'Craps house fee (2%)',
      p_admin_profile_id := v_admin_id
    );
  END IF;

  -- Log round
  INSERT INTO public.craps_rounds
    (profile_id, phase, point_number, die1, die2, total, outcome, bets, gross_payout, fee_amount, net_payout)
  VALUES
    (p_profile_id, p_phase, p_point_number, v_die1, v_die2, v_total, v_outcome, p_bets,
     v_gross_payout, v_fee, v_net_payout)
  RETURNING id INTO v_round_id;

  RETURN jsonb_build_object(
    'round_id',     v_round_id,
    'die1',         v_die1,
    'die2',         v_die2,
    'total',        v_total,
    'outcome',      v_outcome,
    'point_number', v_new_point,
    'gross_payout', v_gross_payout,
    'fee',          v_fee,
    'net_payout',   v_net_payout
  );
END $$;
