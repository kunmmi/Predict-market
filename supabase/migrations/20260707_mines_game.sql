-- Mines game: session-based, multi-step, server-side mine positions

CREATE TABLE IF NOT EXISTS public.mines_games (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         uuid NOT NULL REFERENCES public.profiles(id),
  bet_amount         numeric(20,8) NOT NULL,
  mine_count         int NOT NULL CHECK (mine_count BETWEEN 1 AND 24),
  mine_positions     int[] NOT NULL,          -- hidden from client until game ends
  revealed_positions int[] NOT NULL DEFAULT '{}',
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','cashed_out','exploded','expired')),
  current_multiplier numeric(20,8) NOT NULL DEFAULT 1.0,
  gross_payout       numeric(20,8) NOT NULL DEFAULT 0,
  fee_amount         numeric(20,8) NOT NULL DEFAULT 0,
  net_payout         numeric(20,8) NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  finished_at        timestamptz
);

ALTER TABLE public.mines_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mines_games_own_select" ON public.mines_games;
CREATE POLICY "mines_games_own_select" ON public.mines_games
  FOR SELECT USING (profile_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS mines_games_profile_status ON public.mines_games (profile_id, status);

-- ---------------------------------------------------------------------------
-- Helper: combinations C(n, k)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ncr(n int, k int)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v numeric := 1; i int;
BEGIN
  IF k > n OR k < 0 THEN RETURN 0; END IF;
  IF k > n - k THEN k := n - k; END IF;
  FOR i IN 1..k LOOP
    v := v * (n - k + i) / i;
  END LOOP;
  RETURN v;
END $$;

-- ---------------------------------------------------------------------------
-- start_mines_game
-- Debits wallet, generates mine positions, creates game session.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_mines_game(
  p_profile_id uuid,
  p_bet_amount numeric,
  p_mine_count int
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mine_positions int[];
  v_game_id        uuid;
BEGIN
  IF p_bet_amount <= 0 THEN RAISE EXCEPTION 'Invalid bet amount'; END IF;
  IF p_mine_count < 1 OR p_mine_count > 24 THEN RAISE EXCEPTION 'Mine count must be 1-24'; END IF;

  -- Expire any existing active game for this profile
  UPDATE public.mines_games
  SET status = 'expired', finished_at = now()
  WHERE profile_id = p_profile_id AND status = 'active';

  -- Debit bet immediately
  PERFORM public.debit_wallet(
    p_profile_id      := p_profile_id,
    p_amount          := p_bet_amount,
    p_transaction_type := 'game_debit',
    p_reference_table  := 'mines_games',
    p_reference_id     := gen_random_uuid(),
    p_asset_symbol     := 'USDT',
    p_description      := 'Mines bet'
  );

  -- Generate random mine positions (0..24)
  SELECT array_agg(pos) INTO v_mine_positions
  FROM (
    SELECT pos FROM generate_series(0, 24) pos
    ORDER BY random()
    LIMIT p_mine_count
  ) t;

  INSERT INTO public.mines_games (profile_id, bet_amount, mine_count, mine_positions)
  VALUES (p_profile_id, p_bet_amount, p_mine_count, v_mine_positions)
  RETURNING id INTO v_game_id;

  RETURN jsonb_build_object('game_id', v_game_id, 'mine_count', p_mine_count);
END $$;

-- ---------------------------------------------------------------------------
-- reveal_mines_tile
-- Reveals one tile. Returns whether it was a mine.
-- If mine: game over (no refund). If safe: updates multiplier.
-- If all safe tiles revealed: auto-cashout.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reveal_mines_tile(
  p_profile_id uuid,
  p_game_id    uuid,
  p_tile_index int,
  p_fee_rate   numeric DEFAULT 0.02
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game          public.mines_games%ROWTYPE;
  v_is_mine       boolean;
  v_safe_count    int;
  v_total_safe    int;
  v_multiplier    numeric(20,8);
  v_gross         numeric(20,8);
  v_fee           numeric(20,8);
  v_net           numeric(20,8);
  v_new_revealed  int[];
BEGIN
  SELECT * INTO v_game FROM public.mines_games
  WHERE id = p_game_id AND profile_id = p_profile_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or already finished'; END IF;
  IF p_tile_index < 0 OR p_tile_index > 24 THEN RAISE EXCEPTION 'Invalid tile index'; END IF;
  IF p_tile_index = ANY(v_game.revealed_positions) THEN RAISE EXCEPTION 'Tile already revealed'; END IF;

  v_is_mine   := p_tile_index = ANY(v_game.mine_positions);
  v_total_safe := 25 - v_game.mine_count;

  IF v_is_mine THEN
    -- Game over — mines eat the bet
    UPDATE public.mines_games
    SET status = 'exploded', finished_at = now(),
        revealed_positions = array_append(v_game.revealed_positions, p_tile_index)
    WHERE id = p_game_id;

    RETURN jsonb_build_object(
      'is_mine',       true,
      'status',        'exploded',
      'mine_positions', to_jsonb(v_game.mine_positions),
      'multiplier',    1.0,
      'net_payout',    0
    );
  END IF;

  -- Safe tile
  v_new_revealed := array_append(v_game.revealed_positions, p_tile_index);
  v_safe_count   := array_length(v_new_revealed, 1);

  -- Multiplier = C(25, k) / C(25 - mines, k)
  v_multiplier := public.ncr(25, v_safe_count) / public.ncr(v_total_safe, v_safe_count);

  -- Check if all safe tiles revealed → auto-cashout
  IF v_safe_count = v_total_safe THEN
    v_gross := v_game.bet_amount * v_multiplier;
    v_fee   := CASE WHEN v_gross > v_game.bet_amount
                    THEN ROUND((v_gross - v_game.bet_amount) * p_fee_rate, 8)
                    ELSE 0 END;
    v_net   := v_gross - v_fee;

    PERFORM public.credit_wallet(
      p_profile_id      := p_profile_id,
      p_amount          := v_net,
      p_transaction_type := 'game_credit',
      p_reference_table  := 'mines_games',
      p_reference_id     := p_game_id,
      p_asset_symbol     := 'USDT',
      p_description      := 'Mines auto-cashout (all safe)'
    );
    IF v_fee > 0 THEN
      PERFORM public.credit_platform_wallet(
        p_amount          := v_fee,
        p_transaction_type := 'fee_credit',
        p_reference_table  := 'mines_games',
        p_reference_id     := p_game_id,
        p_asset_symbol     := 'USDT',
        p_description      := 'Mines house fee (2%)'
      );
    END IF;

    UPDATE public.mines_games
    SET status = 'cashed_out', finished_at = now(),
        revealed_positions = v_new_revealed,
        current_multiplier = v_multiplier,
        gross_payout = v_gross, fee_amount = v_fee, net_payout = v_net
    WHERE id = p_game_id;

    RETURN jsonb_build_object(
      'is_mine',        false,
      'status',         'cashed_out',
      'revealed_count', v_safe_count,
      'multiplier',     v_multiplier,
      'mine_positions', to_jsonb(v_game.mine_positions),
      'net_payout',     v_net,
      'fee',            v_fee
    );
  END IF;

  -- Still going
  UPDATE public.mines_games
  SET revealed_positions = v_new_revealed, current_multiplier = v_multiplier
  WHERE id = p_game_id;

  RETURN jsonb_build_object(
    'is_mine',        false,
    'status',         'active',
    'revealed_count', v_safe_count,
    'multiplier',     v_multiplier
  );
END $$;

-- ---------------------------------------------------------------------------
-- cashout_mines_game
-- Player chooses to stop. Pays out at current multiplier.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cashout_mines_game(
  p_profile_id uuid,
  p_game_id    uuid,
  p_fee_rate   numeric DEFAULT 0.02
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game  public.mines_games%ROWTYPE;
  v_gross numeric(20,8);
  v_fee   numeric(20,8);
  v_net   numeric(20,8);
BEGIN
  SELECT * INTO v_game FROM public.mines_games
  WHERE id = p_game_id AND profile_id = p_profile_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found or already finished'; END IF;
  IF array_length(v_game.revealed_positions, 1) IS NULL OR
     array_length(v_game.revealed_positions, 1) < 1 THEN
    RAISE EXCEPTION 'Reveal at least one tile before cashing out';
  END IF;

  v_gross := v_game.bet_amount * v_game.current_multiplier;
  v_fee   := CASE WHEN v_gross > v_game.bet_amount
                  THEN ROUND((v_gross - v_game.bet_amount) * p_fee_rate, 8)
                  ELSE 0 END;
  v_net   := v_gross - v_fee;

  PERFORM public.credit_wallet(
    p_profile_id      := p_profile_id,
    p_amount          := v_net,
    p_transaction_type := 'game_credit',
    p_reference_table  := 'mines_games',
    p_reference_id     := p_game_id,
    p_asset_symbol     := 'USDT',
    p_description      := 'Mines cashout'
  );
  IF v_fee > 0 THEN
    PERFORM public.credit_platform_wallet(
      p_amount          := v_fee,
      p_transaction_type := 'fee_credit',
      p_reference_table  := 'mines_games',
      p_reference_id     := p_game_id,
      p_asset_symbol     := 'USDT',
      p_description      := 'Mines house fee (2%)'
    );
  END IF;

  UPDATE public.mines_games
  SET status = 'cashed_out', finished_at = now(),
      gross_payout = v_gross, fee_amount = v_fee, net_payout = v_net
  WHERE id = p_game_id;

  RETURN jsonb_build_object(
    'net_payout',    v_net,
    'fee',           v_fee,
    'multiplier',    v_game.current_multiplier,
    'mine_positions', to_jsonb(v_game.mine_positions)
  );
END $$;
