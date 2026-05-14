-- Each user wallet gets a unique BSC deposit address derived from the
-- platform HD wallet.  A simple sequence table hands out the next derivation
-- index atomically so two concurrent signups never get the same address.

-- 1. Sequence tracker (single row, locked with SELECT … FOR UPDATE)
CREATE TABLE IF NOT EXISTS public.deposit_address_seq (
  id            int PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforces single row
  next_index    bigint NOT NULL DEFAULT 0
);
INSERT INTO public.deposit_address_seq (id, next_index)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- 2. Add deposit address columns to wallets
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS deposit_address       text UNIQUE,
  ADD COLUMN IF NOT EXISTS deposit_address_index bigint;

CREATE INDEX IF NOT EXISTS idx_wallets_deposit_address
  ON public.wallets (deposit_address)
  WHERE deposit_address IS NOT NULL;

-- 3. RPC: claim the next derivation index (called from the app, not triggers,
--    so it runs with the service-role key and can update the seq table)
CREATE OR REPLACE FUNCTION public.get_next_deposit_index()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_index bigint;
BEGIN
  SELECT next_index INTO v_index
  FROM public.deposit_address_seq
  WHERE id = 1
  FOR UPDATE;

  UPDATE public.deposit_address_seq
  SET next_index = next_index + 1
  WHERE id = 1;

  RETURN v_index;
END;
$$;
