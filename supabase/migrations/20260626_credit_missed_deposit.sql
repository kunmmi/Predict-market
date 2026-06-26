-- Manual credit for missed deposit
-- TX: 0x9cdad5fd1f4c225c2799300fd9d955f27e4b0500f34e578959261975330d5fa9
-- $1 USDT to 0xAC0F212F8e11A3F5c5bc2cad06F215Ef384a87e8 (profile 110379209@qq.com)
-- Confirmed on-chain, not auto-credited due to Moralis indexing lag.

DO $$
DECLARE
  v_tx_hash        text    := '0x9cdad5fd1f4c225c2799300fd9d955f27e4b0500f34e578959261975330d5fa9';
  v_deposit_addr   text    := '0xAC0F212F8e11A3F5c5bc2cad06F215Ef384a87e8';
  v_amount         numeric := 1.0;
  v_profile_id     uuid;
  v_wallet_id      uuid;
  v_bal_before     numeric;
  v_deposit_id     uuid;
BEGIN
  -- Idempotency: skip if already credited
  IF EXISTS (SELECT 1 FROM public.deposits WHERE tx_hash = v_tx_hash) THEN
    RAISE NOTICE 'Already credited — skipping.';
    RETURN;
  END IF;

  -- Resolve wallet
  SELECT id, profile_id, balance
    INTO v_wallet_id, v_profile_id, v_bal_before
    FROM public.wallets
   WHERE deposit_address = v_deposit_addr;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for address %', v_deposit_addr;
  END IF;

  -- Insert deposit record
  INSERT INTO public.deposits (
    profile_id, deposit_address, asset_symbol, network_name,
    amount_received, tx_hash, status
  ) VALUES (
    v_profile_id, v_deposit_addr, 'USDT', 'BSC',
    v_amount, v_tx_hash, 'approved'
  )
  RETURNING id INTO v_deposit_id;

  -- Credit wallet
  UPDATE public.wallets
     SET balance           = balance + v_amount,
         available_balance = available_balance + v_amount,
         updated_at        = now()
   WHERE id = v_wallet_id;

  -- Audit trail
  INSERT INTO public.wallet_transactions (
    wallet_id, profile_id, transaction_type, amount, direction,
    asset_symbol, reference_table, reference_id,
    balance_before, balance_after, description
  ) VALUES (
    v_wallet_id, v_profile_id, 'deposit_credit', v_amount, 'credit',
    'USDT', 'deposits', v_deposit_id,
    v_bal_before, v_bal_before + v_amount,
    'USDT deposit credited manually — Moralis indexing lag'
  );

  RAISE NOTICE 'Credited $% USDT to profile % (wallet %)', v_amount, v_profile_id, v_wallet_id;
END $$;
