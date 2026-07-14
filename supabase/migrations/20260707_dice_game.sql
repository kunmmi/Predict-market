-- Dice game: roll 0-99, bet over or under a target number

CREATE TABLE IF NOT EXISTS public.dice_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id),
  bet_amount    numeric(20,8) NOT NULL,
  target        int NOT NULL CHECK (target BETWEEN 2 AND 98),
  direction     text NOT NULL CHECK (direction IN ('over','under')),
  roll          int NOT NULL CHECK (roll BETWEEN 0 AND 99),
  won           boolean NOT NULL,
  multiplier    numeric(10,4) NOT NULL,
  gross_payout  numeric(20,8) NOT NULL DEFAULT 0,
  fee_amount    numeric(20,8) NOT NULL DEFAULT 0,
  net_payout    numeric(20,8) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.dice_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dice_rounds_own_select" ON public.dice_rounds;
CREATE POLICY "dice_rounds_own_select" ON public.dice_rounds
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

-- resolve_dice_round
-- Rolls 0-99 server-side, settles bet. Multiplier = 99 / winning_outcomes (1% house edge).
CREATE OR REPLACE FUNCTION public.resolve_dice_round(
  p_profile_id uuid,
  p_bet_amount numeric,
  p_target     int,
  p_direction  text,          -- 'over' or 'under'
  p_fee_rate   numeric DEFAULT 0.02
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_roll         int;
  v_won          boolean;
  v_win_count    int;
  v_multiplier   numeric(10,4);
  v_gross        numeric(20,8) := 0;
  v_fee          numeric(20,8) := 0;
  v_net          numeric(20,8) := 0;
  v_round_id     uuid;
BEGIN
  IF p_target < 2 OR p_target > 98 THEN RAISE EXCEPTION 'Target must be between 2 and 98'; END IF;
  IF p_direction NOT IN ('over','under') THEN RAISE EXCEPTION 'Direction must be over or under'; END IF;

  v_roll := floor(random() * 100)::int;

  IF p_direction = 'over' THEN
    v_won      := v_roll > p_target;
    v_win_count := 99 - p_target;   -- values p_target+1 .. 99
  ELSE
    v_won      := v_roll < p_target;
    v_win_count := p_target;         -- values 0 .. p_target-1
  END IF;

  -- 1% house edge baked into multiplier
  v_multiplier := ROUND(99.0 / v_win_count, 4);

  -- Debit bet
  PERFORM public.debit_wallet(
    p_profile_id      := p_profile_id,
    p_amount          := p_bet_amount,
    p_transaction_type := 'game_debit',
    p_reference_table  := 'dice_rounds',
    p_reference_id     := gen_random_uuid(),
    p_asset_symbol     := 'USDT',
    p_description      := 'Dice bet'
  );

  IF v_won THEN
    v_gross := p_bet_amount * v_multiplier;
    v_fee   := CASE WHEN v_gross > p_bet_amount
                    THEN ROUND((v_gross - p_bet_amount) * p_fee_rate, 8)
                    ELSE 0 END;
    v_net   := v_gross - v_fee;

    PERFORM public.credit_wallet(
      p_profile_id      := p_profile_id,
      p_amount          := v_net,
      p_transaction_type := 'game_credit',
      p_reference_table  := 'dice_rounds',
      p_reference_id     := gen_random_uuid(),
      p_asset_symbol     := 'USDT',
      p_description      := 'Dice payout'
    );
    IF v_fee > 0 THEN
      PERFORM public.credit_platform_wallet(
        p_amount          := v_fee,
        p_transaction_type := 'fee_credit',
        p_reference_table  := 'dice_rounds',
        p_reference_id     := gen_random_uuid(),
        p_asset_symbol     := 'USDT',
        p_description      := 'Dice house fee (2%)'
      );
    END IF;
  END IF;

  INSERT INTO public.dice_rounds
    (profile_id, bet_amount, target, direction, roll, won, multiplier, gross_payout, fee_amount, net_payout)
  VALUES
    (p_profile_id, p_bet_amount, p_target, p_direction, v_roll, v_won, v_multiplier, v_gross, v_fee, v_net)
  RETURNING id INTO v_round_id;

  RETURN jsonb_build_object(
    'round_id',   v_round_id,
    'roll',       v_roll,
    'won',        v_won,
    'multiplier', v_multiplier,
    'net_payout', v_net,
    'fee',        v_fee
  );
END $$;
