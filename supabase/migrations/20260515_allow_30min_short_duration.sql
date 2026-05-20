-- Allow 30-minute short-duration markets.
-- Drops the old CHECK constraint that limited durations to (3, 5, 10, 15)
-- and replaces it with one that also accepts 30.

ALTER TABLE public.markets
  DROP CONSTRAINT IF EXISTS chk_markets_duration_minutes;

ALTER TABLE public.markets
  ADD CONSTRAINT chk_markets_duration_minutes
    CHECK (duration_minutes IS NULL OR duration_minutes IN (3, 5, 10, 15, 30));

COMMENT ON COLUMN public.markets.duration_minutes IS
  'NULL = standard long-form market. 3/5/10/15/30 = short-duration contract (minutes).';
