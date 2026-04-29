-- Migration: short-duration markets
-- Adds three columns to markets to support 3/5/10/15-minute binary option contracts
-- that auto-settle based on live Binance price feed.

ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS duration_minutes   smallint      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_direction   text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS spot_price_at_open numeric(20,8) DEFAULT NULL;

ALTER TABLE public.markets
  ADD CONSTRAINT chk_markets_target_direction
    CHECK (target_direction IS NULL OR target_direction IN ('above', 'below')),
  ADD CONSTRAINT chk_markets_duration_minutes
    CHECK (duration_minutes IS NULL OR duration_minutes IN (3, 5, 10, 15));

COMMENT ON COLUMN public.markets.duration_minutes   IS 'NULL = standard long-form market. 3/5/10/15 = short-duration contract (minutes).';
COMMENT ON COLUMN public.markets.target_direction   IS 'For short-duration markets: ''above'' or ''below'' the spot_price_at_open.';
COMMENT ON COLUMN public.markets.spot_price_at_open IS 'Binance spot price recorded at the moment the short-duration market was activated.';
