-- Plinko game: 16-row Galton board, 3 risk levels

CREATE TABLE IF NOT EXISTS public.plinko_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id),
  bet_amount    numeric(20,8) NOT NULL,
  risk          text NOT NULL CHECK (risk IN ('low','medium','high')),
  slot          int NOT NULL CHECK (slot BETWEEN 0 AND 16),
  multiplier    numeric(10,4) NOT NULL,
  gross_payout  numeric(20,8) NOT NULL DEFAULT 0,
  fee_amount    numeric(20,8) NOT NULL DEFAULT 0,
  net_payout    numeric(20,8) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.plinko_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plinko_rounds_own_select" ON public.plinko_rounds;
CREATE POLICY "plinko_rounds_own_select" ON public.plinko_rounds
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

-- resolve_plinko_round
-- Simulates a ball falling through 16 rows of pegs (Galton board).
-- Final slot = number of right turns (0-16, binomial distribution).
CREATE OR REPLACE FUNCTION public.resolve_plinko_round(
  p_profile_id uuid,
  p_bet_amount numeric,
  p_risk       text,
  p_fee_rate   numeric DEFAULT 0.02
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot       int := 0;
  v_multiplier numeric(10,4);
  v_gross      numeric(20,8) := 0;
  v_fee        numeric(20,8) := 0;
  v_net        numeric(20,8) := 0;
  v_round_id   uuid;
  i            int;

  -- Multiplier tables for each risk level (17 slots, index 0-16)
  v_low    numeric[] := ARRAY[16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16];
  v_medium numeric[] := ARRAY[110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110];
  v_high   numeric[] := ARRAY[1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000];
BEGIN
  IF p_risk NOT IN ('low','medium','high') THEN RAISE EXCEPTION 'Risk must be low, medium, or high'; END IF;

  -- Simulate 16 rows — each row ball goes right with 50% probability
  FOR i IN 1..16 LOOP
    IF random() > 0.5 THEN v_slot := v_slot + 1; END IF;
  END LOOP;

  -- Look up multiplier (arrays are 1-indexed in PG, slot is 0-indexed)
  IF p_risk = 'low'    THEN v_multiplier := v_low[v_slot + 1];
  ELSIF p_risk = 'medium' THEN v_multiplier := v_medium[v_slot + 1];
  ELSE                      v_multiplier := v_high[v_slot + 1];
  END IF;

  -- Debit bet
  PERFORM public.debit_wallet(
    p_profile_id      := p_profile_id,
    p_amount          := p_bet_amount,
    p_transaction_type := 'game_debit',
    p_reference_table  := 'plinko_rounds',
    p_reference_id     := gen_random_uuid(),
    p_asset_symbol     := 'USDT',
    p_description      := 'Plinko bet'
  );

  v_gross := p_bet_amount * v_multiplier;
  v_fee   := CASE WHEN v_gross > p_bet_amount
                  THEN ROUND((v_gross - p_bet_amount) * p_fee_rate, 8)
                  ELSE 0 END;
  v_net   := v_gross - v_fee;

  IF v_net > 0 THEN
    PERFORM public.credit_wallet(
      p_profile_id      := p_profile_id,
      p_amount          := v_net,
      p_transaction_type := 'game_credit',
      p_reference_table  := 'plinko_rounds',
      p_reference_id     := gen_random_uuid(),
      p_asset_symbol     := 'USDT',
      p_description      := 'Plinko payout'
    );
  END IF;
  IF v_fee > 0 THEN
    PERFORM public.credit_platform_wallet(
      p_amount          := v_fee,
      p_transaction_type := 'fee_credit',
      p_reference_table  := 'plinko_rounds',
      p_reference_id     := gen_random_uuid(),
      p_asset_symbol     := 'USDT',
      p_description      := 'Plinko house fee (2%)'
    );
  END IF;

  INSERT INTO public.plinko_rounds
    (profile_id, bet_amount, risk, slot, multiplier, gross_payout, fee_amount, net_payout)
  VALUES
    (p_profile_id, p_bet_amount, p_risk, v_slot, v_multiplier, v_gross, v_fee, v_net)
  RETURNING id INTO v_round_id;

  RETURN jsonb_build_object(
    'round_id',   v_round_id,
    'slot',       v_slot,
    'multiplier', v_multiplier,
    'net_payout', v_net,
    'fee',        v_fee
  );
END $$;
