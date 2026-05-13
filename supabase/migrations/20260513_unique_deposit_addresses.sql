-- Migration: unique per-user BSC deposit addresses
--
-- Each user gets one deterministic BSC address derived from the platform HD
-- wallet (DEPOSIT_WALLET_XPUB).  When USDT arrives at their address, the
-- Tatum webhook credits their balance automatically — no deposit form needed.

-- 1. Add columns to wallets
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS deposit_address      text UNIQUE,
  ADD COLUMN IF NOT EXISTS deposit_address_index integer;

CREATE INDEX IF NOT EXISTS idx_wallets_deposit_address
  ON public.wallets (deposit_address)
  WHERE deposit_address IS NOT NULL;

-- 2. Singleton sequence table — tracks the next derivation index.
--    Using a table + atomic UPDATE avoids race conditions when two users sign
--    up simultaneously.
CREATE TABLE IF NOT EXISTS public.deposit_address_seq (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_index  integer NOT NULL DEFAULT 0
);

INSERT INTO public.deposit_address_seq (id, next_index)
VALUES (1, 0)
ON CONFLICT DO NOTHING;

-- 3. Atomic index reservation function.
--    Returns the index to use for this user, then increments.
CREATE OR REPLACE FUNCTION public.get_next_deposit_index()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_index integer;
BEGIN
  UPDATE public.deposit_address_seq
  SET next_index = next_index + 1
  WHERE id = 1
  RETURNING next_index - 1 INTO v_index;
  RETURN v_index;
END;
$$;
