-- Add 'payout_debit' transaction type to platform_wallet_transactions constraint
-- Required for settle_multi_market to debit the platform wallet when paying out winners

ALTER TABLE public.platform_wallet_transactions
  DROP CONSTRAINT chk_platform_wallet_transaction_type;

ALTER TABLE public.platform_wallet_transactions
  ADD CONSTRAINT chk_platform_wallet_transaction_type CHECK (
    transaction_type IN (
      'fee_credit',
      'withdrawal_debit',
      'adjustment_credit',
      'adjustment_debit',
      'payout_debit'
    )
  );
