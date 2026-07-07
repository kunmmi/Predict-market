-- Crash game: audit table + server-side resolution function

CREATE TABLE IF NOT EXISTS public.crash_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id),
  bet_amount    numeric(20,8) NOT NULL,
  auto_cashout  numeric(10,2) NOT NULL,
  crashed_at    numeric(10,2) NOT NULL,
  cashout_at    numeric(10,2),
  won           boolean NOT NULL,
  gross_payout  numeric(20,8) NOT NULL DEFAULT 0,
  fee_amount    numeric(20,8) NOT NULL DEFAULT 0,
  net_payout    numeric(20,8) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.crash_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crash_rounds_own_select" ON public.crash_rounds;
CREATE POLICY "crash_rounds_own_select" ON public.crash_rounds
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

-- resolve_crash_round
-- Picks crash multiplier server-side (1% instant-crash house edge),
-- then settles the bet against the player's auto-cashout target.
CREATE OR REPLACE FUNCTION public.resolve_crash_round(
  p_profile_id  uuid,
  p_bet_amount  numeric,
  p_auto_cashout numeric,
  p_fee_rate    numeric DEFAULT 0.02
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_u           float;
  v_crash_at    numeric(10,2);
  v_won         boolean;
  v_cashout_at  numeric(10,2);
  v_gross       numeric(20,8) := 0;
  v_fee         numeric(20,8) := 0;
  v_net         numeric(20,8) := 0;
  v_round_id    uuid;
BEGIN
  -- Generate crash point (1% chance of instant crash, otherwise exponential)
  v_u := random();
  IF v_u < 0.01 THEN
    v_crash_at := 1.00;
  ELSE
    v_crash_at := GREATEST(1.00, FLOOR(100.0 * 0.99 / (1.0 - v_u)) / 100.0);
  END IF;

  -- Settle: did the rocket survive to the player's target?
  IF v_crash_at >= p_auto_cashout THEN
    v_won        := true;
    v_cashout_at := p_auto_cashout;
    v_gross      := p_bet_amount * v_cashout_at;
  ELSE
    v_won        := false;
    v_cashout_at := NULL;
    v_gross      := 0;
  END IF;

  -- Debit bet
  PERFORM public.debit_wallet(
    p_profile_id      := p_profile_id,
    p_amount          := p_bet_amount,
    p_transaction_type := 'game_debit',
    p_reference_table  := 'crash_rounds',
    p_reference_id     := gen_random_uuid(),
    p_asset_symbol     := 'USDT',
    p_description      := 'Crash bet'
  );

  -- Fee on profit only
  IF v_gross > p_bet_amount THEN
    v_fee := ROUND((v_gross - p_bet_amount) * p_fee_rate, 8);
  END IF;
  v_net := v_gross - v_fee;

  -- Credit winnings
  IF v_net > 0 THEN
    PERFORM public.credit_wallet(
      p_profile_id      := p_profile_id,
      p_amount          := v_net,
      p_transaction_type := 'game_credit',
      p_reference_table  := 'crash_rounds',
      p_reference_id     := gen_random_uuid(),
      p_asset_symbol     := 'USDT',
      p_description      := 'Crash payout'
    );
  END IF;

  -- Platform fee
  IF v_fee > 0 THEN
    PERFORM public.credit_platform_wallet(
      p_amount          := v_fee,
      p_transaction_type := 'fee_credit',
      p_reference_table  := 'crash_rounds',
      p_reference_id     := gen_random_uuid(),
      p_asset_symbol     := 'USDT',
      p_description      := 'Crash house fee (2%)'
    );
  END IF;

  -- Audit row
  INSERT INTO public.crash_rounds
    (profile_id, bet_amount, auto_cashout, crashed_at, cashout_at, won, gross_payout, fee_amount, net_payout)
  VALUES
    (p_profile_id, p_bet_amount, p_auto_cashout, v_crash_at, v_cashout_at, v_won, v_gross, v_fee, v_net)
  RETURNING id INTO v_round_id;

  RETURN jsonb_build_object(
    'round_id',    v_round_id,
    'crashed_at',  v_crash_at,
    'cashout_at',  v_cashout_at,
    'won',         v_won,
    'gross_payout', v_gross,
    'fee',         v_fee,
    'net_payout',  v_net
  );
END $$;
