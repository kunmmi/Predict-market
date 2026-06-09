-- Allow 60-minute duration for markets
ALTER TABLE public.markets
  DROP CONSTRAINT IF EXISTS chk_markets_duration_minutes;

ALTER TABLE public.markets
  ADD CONSTRAINT chk_markets_duration_minutes
  CHECK (duration_minutes IS NULL OR duration_minutes IN (3, 5, 10, 15, 30, 60));
