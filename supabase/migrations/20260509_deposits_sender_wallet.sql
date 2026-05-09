-- Add sender_wallet to deposits table for wallet-connect deposit flow.
-- Stores the on-chain address that initiated the deposit, used to verify
-- tx.from matches the user's connected wallet during auto-verification.

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS sender_wallet TEXT;

COMMENT ON COLUMN public.deposits.sender_wallet IS
  'EVM wallet address (lowercase) that sent the deposit transaction. Used to verify tx.from during on-chain verification.';
