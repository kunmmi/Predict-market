-- =============================================================================
-- Lock platform_wallets balance against direct modification
--
-- The balance/available_balance/reserved_balance columns must only change
-- through the security-definer functions:
--   - credit_platform_wallet(...)
--   - debit_platform_wallet(...)  (if it exists)
--
-- Revoking UPDATE/DELETE from all client-facing roles means:
--   - REST API (service_role) cannot PATCH the row directly
--   - Supabase dashboard cannot edit the balance directly
--   - Application code cannot accidentally overwrite the balance
--
-- INSERT is kept on service_role so ensurePlatformWallet() can create the
-- row on first boot. The security-definer functions run as the postgres
-- role and are unaffected by these grants.
-- =============================================================================

REVOKE UPDATE ON public.platform_wallets FROM service_role;
REVOKE UPDATE ON public.platform_wallets FROM authenticated;
REVOKE UPDATE ON public.platform_wallets FROM anon;

REVOKE DELETE ON public.platform_wallets FROM service_role;
REVOKE DELETE ON public.platform_wallets FROM authenticated;
REVOKE DELETE ON public.platform_wallets FROM anon;

-- Also lock the transaction log — it should be append-only
REVOKE UPDATE ON public.platform_wallet_transactions FROM service_role;
REVOKE UPDATE ON public.platform_wallet_transactions FROM authenticated;
REVOKE UPDATE ON public.platform_wallet_transactions FROM anon;

REVOKE DELETE ON public.platform_wallet_transactions FROM service_role;
REVOKE DELETE ON public.platform_wallet_transactions FROM authenticated;
REVOKE DELETE ON public.platform_wallet_transactions FROM anon;
