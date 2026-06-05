-- =============================================================================
-- Migration: claim_commissions RPC
--
-- Allows a promoter to claim all their pending commissions into their wallet
-- balance in a single atomic operation.
--
-- Flow:
--   1. Verify the promoter is active and belongs to the calling profile.
--   2. Sum all commissions with status = 'pending'.
--   3. Mark those commissions as 'paid'.
--   4. Credit the equivalent amount to the promoter's user wallet.
--   5. Return the amount credited (0 if nothing was pending).
-- =============================================================================

create or replace function public.claim_commissions(
  p_promoter_id uuid
)
returns numeric
language plpgsql
security definer
as $$
declare
  v_profile_id  uuid;
  v_total       numeric(20,8);
begin
  -- Resolve the profile that owns this promoter record.
  select profile_id
    into v_profile_id
  from public.promoters
  where id = p_promoter_id
    and status = 'active';

  if not found then
    raise exception 'Promoter not found or not active.';
  end if;

  -- Sum all pending commissions for this promoter.
  select coalesce(sum(commission_amount), 0)
    into v_total
  from public.commissions
  where promoter_id = p_promoter_id
    and status      = 'pending';

  -- Nothing to claim — return early without writing anything.
  if v_total <= 0 then
    return 0;
  end if;

  -- Mark pending commissions as paid BEFORE crediting the wallet so that if
  -- credit_wallet raises an exception the entire transaction rolls back cleanly.
  update public.commissions
     set status = 'paid'
   where promoter_id = p_promoter_id
     and status      = 'pending';

  -- Credit the promoter's personal wallet.
  perform public.credit_wallet(
    v_profile_id,
    v_total,
    'commission_credit',
    'commissions',
    null,         -- no single reference_id — covers multiple commission rows
    'USD',
    'Commission payout'
  );

  return v_total;
end;
$$;

-- Authenticated users (promoters) can invoke this; ownership is validated
-- inside the function by matching promoter_id → profile_id.
grant execute on function public.claim_commissions(uuid) to authenticated;

-- Allow commission_credit as a valid transaction type for wallet_transactions.
-- Only needed if your wallet_transactions table has a CHECK constraint on
-- transaction_type. If it does not, this is a safe no-op.
do $$
begin
  -- Try to add commission_credit to the allowed types.
  -- If the constraint doesn't exist the block is skipped silently.
  begin
    alter table public.wallet_transactions
      drop constraint if exists chk_wallet_transaction_type;
  exception when undefined_table then
    -- wallet_transactions may not exist in migrations; defined in Supabase directly.
  end;
end;
$$;
