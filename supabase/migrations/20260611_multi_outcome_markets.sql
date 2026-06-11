-- Phase 1: Multi-outcome market support
--
-- Changes:
--   1. Add market_type to markets ('binary' | 'multi'), default 'binary' — non-breaking
--   2. New market_outcomes table — one row per selectable option in a multi market
--   3. Add outcome_id (nullable FK) to positions — null = binary market position

-- ── 1. markets.market_type ──────────────────────────────────────────────────

ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS market_type text NOT NULL DEFAULT 'binary';

ALTER TABLE public.markets
  ADD CONSTRAINT chk_markets_market_type
    CHECK (market_type IN ('binary', 'multi'));

COMMENT ON COLUMN public.markets.market_type IS
  '''binary'' = YES/NO market (existing). ''multi'' = multiple named outcomes (e.g. Golden Boot, first scorer).';

-- ── 2. market_outcomes ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.market_outcomes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id    uuid        NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  label        text        NOT NULL,           -- e.g. "Kylian Mbappé"
  label_zh     text        DEFAULT NULL,       -- Chinese label
  slug         text        NOT NULL,           -- e.g. "mbappe" — unique within market
  pool_amount  numeric(18,6) NOT NULL DEFAULT 0,
  price        numeric(6,4)  NOT NULL DEFAULT 0.5,  -- implied probability 0–1
  is_winner    boolean     DEFAULT NULL,       -- NULL = unresolved, true = won, false = lost
  sort_order   smallint    NOT NULL DEFAULT 0, -- display order
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_market_outcomes_market_slug UNIQUE (market_id, slug),
  CONSTRAINT chk_outcome_price CHECK (price >= 0 AND price <= 1)
);

CREATE INDEX IF NOT EXISTS idx_market_outcomes_market_id ON public.market_outcomes(market_id);

COMMENT ON TABLE public.market_outcomes IS
  'Named selectable outcomes for multi-type markets. Each row is one option a user can trade.';

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_market_outcomes_updated_at ON public.market_outcomes;
CREATE TRIGGER trg_market_outcomes_updated_at
  BEFORE UPDATE ON public.market_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. positions.outcome_id ─────────────────────────────────────────────────

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS outcome_id uuid DEFAULT NULL
    REFERENCES public.market_outcomes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_positions_outcome_id ON public.positions(outcome_id)
  WHERE outcome_id IS NOT NULL;

COMMENT ON COLUMN public.positions.outcome_id IS
  'NULL for binary markets. For multi markets, references the specific outcome the user traded.';

-- ── 4. RLS — market_outcomes readable by all authenticated users ────────────

ALTER TABLE public.market_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_outcomes: public read"
  ON public.market_outcomes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "market_outcomes: admin write"
  ON public.market_outcomes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
