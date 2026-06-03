-- Track which deposit addresses have been initialized for gasless sweeping.
-- When sweep_approved_at IS NOT NULL the master wallet has been granted
-- USDT.approve(master, MaxUint256) from that address and can call
-- transferFrom without needing BNB in the deposit address again.

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS sweep_approved_at timestamptz;

COMMENT ON COLUMN public.wallets.sweep_approved_at IS
  'Timestamp when USDT.approve(masterWallet, MaxUint256) was broadcast from this deposit address. '
  'NULL means the address has not yet been initialized for gasless sweeping.';
