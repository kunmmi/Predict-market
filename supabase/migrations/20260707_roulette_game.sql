-- Roulette game: European single-zero wheel

CREATE TABLE IF NOT EXISTS public.roulette_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id),
  bets          jsonb NOT NULL,
  winning_number int NOT NULL CHECK (winning_number BETWEEN 0 AND 36),
  total_bet     numeric(20,8) NOT NULL,
  gross_payout  numeric(20,8) NOT NULL DEFAULT 0,
  fee_amount    numeric(20,8) NOT NULL DEFAULT 0,
  net_payout    numeric(20,8) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.roulette_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roulette_rounds_own_select" ON public.roulette_rounds;
CREATE POLICY "roulette_rounds_own_select" ON public.roulette_rounds
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

-- resolve_roulette_round
-- Spins the wheel server-side (0-36 European), settles all bets atomically.
-- Bets JSON: [{ type: 'red'|'black'|'odd'|'even'|'low'|'high'|'dozen1'|'dozen2'|'dozen3'|'straight', number?: 0-36, amount: numeric }]
CREATE OR REPLACE FUNCTION public.resolve_roulette_round(
  p_profile_id uuid,
  p_bets       jsonb,
  p_fee_rate   numeric DEFAULT 0.02
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winning     int;
  v_total_bet   numeric(20,8) := 0;
  v_gross       numeric(20,8) := 0;
  v_fee         numeric(20,8) := 0;
  v_net         numeric(20,8) := 0;
  v_bet         jsonb;
  v_type        text;
  v_amount      numeric(20,8);
  v_bet_num     int;
  v_round_id    uuid;

  -- Red numbers on European wheel
  v_red_numbers int[] := ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
BEGIN
  -- Spin wheel: 0-36 (37 slots, European)
  v_winning := floor(random() * 37)::int;

  -- Sum total bet
  FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets) LOOP
    v_total_bet := v_total_bet + (v_bet->>'amount')::numeric;
  END LOOP;

  IF v_total_bet <= 0 THEN
    RAISE EXCEPTION 'No bets placed';
  END IF;

  -- Debit total bet
  PERFORM public.debit_wallet(
    p_profile_id      := p_profile_id,
    p_amount          := v_total_bet,
    p_transaction_type := 'game_debit',
    p_reference_table  := 'roulette_rounds',
    p_reference_id     := gen_random_uuid(),
    p_asset_symbol     := 'USDT',
    p_description      := 'Roulette bet'
  );

  -- Resolve each bet
  FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets) LOOP
    v_type   := v_bet->>'type';
    v_amount := (v_bet->>'amount')::numeric;
    v_bet_num := COALESCE((v_bet->>'number')::int, -1);

    -- Straight up (35:1)
    IF v_type = 'straight' THEN
      IF v_winning = v_bet_num THEN
        v_gross := v_gross + v_amount * 36;
      END IF;

    -- Red (1:1) — 0 loses
    ELSIF v_type = 'red' THEN
      IF v_winning = ANY(v_red_numbers) THEN
        v_gross := v_gross + v_amount * 2;
      END IF;

    -- Black (1:1) — 0 loses
    ELSIF v_type = 'black' THEN
      IF v_winning > 0 AND NOT (v_winning = ANY(v_red_numbers)) THEN
        v_gross := v_gross + v_amount * 2;
      END IF;

    -- Odd (1:1) — 0 loses
    ELSIF v_type = 'odd' THEN
      IF v_winning > 0 AND v_winning % 2 = 1 THEN
        v_gross := v_gross + v_amount * 2;
      END IF;

    -- Even (1:1) — 0 loses
    ELSIF v_type = 'even' THEN
      IF v_winning > 0 AND v_winning % 2 = 0 THEN
        v_gross := v_gross + v_amount * 2;
      END IF;

    -- Low 1-18 (1:1)
    ELSIF v_type = 'low' THEN
      IF v_winning BETWEEN 1 AND 18 THEN
        v_gross := v_gross + v_amount * 2;
      END IF;

    -- High 19-36 (1:1)
    ELSIF v_type = 'high' THEN
      IF v_winning BETWEEN 19 AND 36 THEN
        v_gross := v_gross + v_amount * 2;
      END IF;

    -- Dozen 1 (1-12, 2:1)
    ELSIF v_type = 'dozen1' THEN
      IF v_winning BETWEEN 1 AND 12 THEN
        v_gross := v_gross + v_amount * 3;
      END IF;

    -- Dozen 2 (13-24, 2:1)
    ELSIF v_type = 'dozen2' THEN
      IF v_winning BETWEEN 13 AND 24 THEN
        v_gross := v_gross + v_amount * 3;
      END IF;

    -- Dozen 3 (25-36, 2:1)
    ELSIF v_type = 'dozen3' THEN
      IF v_winning BETWEEN 25 AND 36 THEN
        v_gross := v_gross + v_amount * 3;
      END IF;

    END IF;
  END LOOP;

  -- Fee on profit only
  IF v_gross > v_total_bet THEN
    v_fee := ROUND((v_gross - v_total_bet) * p_fee_rate, 8);
  END IF;
  v_net := v_gross - v_fee;

  -- Credit winnings
  IF v_net > 0 THEN
    PERFORM public.credit_wallet(
      p_profile_id      := p_profile_id,
      p_amount          := v_net,
      p_transaction_type := 'game_credit',
      p_reference_table  := 'roulette_rounds',
      p_reference_id     := gen_random_uuid(),
      p_asset_symbol     := 'USDT',
      p_description      := 'Roulette payout'
    );
  END IF;

  -- Platform fee
  IF v_fee > 0 THEN
    PERFORM public.credit_platform_wallet(
      p_amount          := v_fee,
      p_transaction_type := 'fee_credit',
      p_reference_table  := 'roulette_rounds',
      p_reference_id     := gen_random_uuid(),
      p_asset_symbol     := 'USDT',
      p_description      := 'Roulette house fee (2%)'
    );
  END IF;

  -- Audit row
  INSERT INTO public.roulette_rounds
    (profile_id, bets, winning_number, total_bet, gross_payout, fee_amount, net_payout)
  VALUES
    (p_profile_id, p_bets, v_winning, v_total_bet, v_gross, v_fee, v_net)
  RETURNING id INTO v_round_id;

  RETURN jsonb_build_object(
    'round_id',       v_round_id,
    'winning_number', v_winning,
    'gross_payout',   v_gross,
    'fee',            v_fee,
    'net_payout',     v_net
  );
END $$;
