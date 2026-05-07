-- Migration: shared platform wallet for admin fee collection and withdrawals

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'withdrawal_status') THEN
    CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_key text NOT NULL UNIQUE DEFAULT 'general_admin',
  balance numeric(20,8) NOT NULL DEFAULT 0,
  available_balance numeric(20,8) NOT NULL DEFAULT 0,
  reserved_balance numeric(20,8) NOT NULL DEFAULT 0,
  status wallet_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_wallet_balance_nonnegative CHECK (balance >= 0),
  CONSTRAINT chk_platform_wallet_available_nonnegative CHECK (available_balance >= 0),
  CONSTRAINT chk_platform_wallet_reserved_nonnegative CHECK (reserved_balance >= 0),
  CONSTRAINT chk_platform_wallet_balance_consistency CHECK (balance = available_balance + reserved_balance)
);

CREATE INDEX IF NOT EXISTS idx_platform_wallets_wallet_key ON public.platform_wallets(wallet_key);

DROP TRIGGER IF EXISTS trg_platform_wallets_updated_at ON public.platform_wallets;
CREATE TRIGGER trg_platform_wallets_updated_at
BEFORE UPDATE ON public.platform_wallets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.platform_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_wallet_id uuid NOT NULL REFERENCES public.platform_wallets(id) ON DELETE CASCADE,
  admin_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  transaction_type text NOT NULL,
  reference_table text,
  reference_id uuid,
  asset_symbol text NOT NULL DEFAULT 'USDT',
  amount numeric(20,8) NOT NULL,
  direction entry_direction NOT NULL,
  balance_before numeric(20,8) NOT NULL,
  balance_after numeric(20,8) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_wallet_transactions_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_platform_wallet_transaction_type CHECK (
    transaction_type IN ('fee_credit', 'withdrawal_debit', 'adjustment_credit', 'adjustment_debit')
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_wallet_id
  ON public.platform_wallet_transactions(platform_wallet_id);
CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_admin_profile_id
  ON public.platform_wallet_transactions(admin_profile_id);
CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_reference
  ON public.platform_wallet_transactions(reference_table, reference_id);
CREATE INDEX IF NOT EXISTS idx_platform_wallet_transactions_created_at
  ON public.platform_wallet_transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_wallet_id uuid NOT NULL REFERENCES public.platform_wallets(id) ON DELETE CASCADE,
  requested_by_admin_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  asset_symbol text NOT NULL,
  network_name text,
  amount numeric(20,8) NOT NULL,
  crypto_amount numeric(30,12),
  withdrawal_address text NOT NULL,
  tx_hash text,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_withdrawals_asset_symbol
    CHECK (asset_symbol = 'USDT'),
  CONSTRAINT chk_platform_withdrawals_network_name
    CHECK (network_name IS NULL OR network_name = 'BNB Smart Chain (BEP-20)'),
  CONSTRAINT chk_platform_withdrawals_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_platform_withdrawals_crypto_amount_nonnegative CHECK (crypto_amount IS NULL OR crypto_amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_wallet_id
  ON public.platform_withdrawals(platform_wallet_id);
CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_requested_by
  ON public.platform_withdrawals(requested_by_admin_profile_id);
CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_status
  ON public.platform_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_created_at
  ON public.platform_withdrawals(created_at DESC);

DROP TRIGGER IF EXISTS trg_platform_withdrawals_updated_at ON public.platform_withdrawals;
CREATE TRIGGER trg_platform_withdrawals_updated_at
BEFORE UPDATE ON public.platform_withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.platform_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ensure_platform_wallet(
  p_wallet_key text DEFAULT 'general_admin'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  INSERT INTO public.platform_wallets (wallet_key)
  VALUES (coalesce(p_wallet_key, 'general_admin'))
  ON CONFLICT (wallet_key) DO NOTHING;

  SELECT id
    INTO v_wallet_id
  FROM public.platform_wallets
  WHERE wallet_key = coalesce(p_wallet_key, 'general_admin');

  RETURN v_wallet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_platform_wallet(
  p_amount numeric,
  p_transaction_type text,
  p_reference_table text,
  p_reference_id uuid,
  p_asset_symbol text,
  p_description text DEFAULT NULL,
  p_wallet_key text DEFAULT 'general_admin',
  p_admin_profile_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet public.platform_wallets%rowtype;
  v_wallet_id uuid;
  v_new_balance numeric(20,8);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'credit amount must be greater than zero';
  END IF;

  v_wallet_id := public.ensure_platform_wallet(p_wallet_key);

  SELECT *
    INTO v_wallet
  FROM public.platform_wallets
  WHERE id = v_wallet_id
  FOR UPDATE;

  v_new_balance := v_wallet.balance + p_amount;

  UPDATE public.platform_wallets
  SET balance = v_new_balance,
      available_balance = available_balance + p_amount
  WHERE id = v_wallet.id;

  INSERT INTO public.platform_wallet_transactions (
    platform_wallet_id,
    admin_profile_id,
    transaction_type,
    reference_table,
    reference_id,
    asset_symbol,
    amount,
    direction,
    balance_before,
    balance_after,
    description
  )
  VALUES (
    v_wallet.id,
    p_admin_profile_id,
    p_transaction_type,
    p_reference_table,
    p_reference_id,
    coalesce(p_asset_symbol, 'USDT'),
    p_amount,
    'credit',
    v_wallet.balance,
    v_new_balance,
    p_description
  );

  RETURN v_wallet.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.debit_platform_wallet(
  p_amount numeric,
  p_transaction_type text,
  p_reference_table text,
  p_reference_id uuid,
  p_asset_symbol text,
  p_description text DEFAULT NULL,
  p_wallet_key text DEFAULT 'general_admin',
  p_admin_profile_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet public.platform_wallets%rowtype;
  v_wallet_id uuid;
  v_new_balance numeric(20,8);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'debit amount must be greater than zero';
  END IF;

  v_wallet_id := public.ensure_platform_wallet(p_wallet_key);

  SELECT *
    INTO v_wallet
  FROM public.platform_wallets
  WHERE id = v_wallet_id
  FOR UPDATE;

  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient available platform wallet balance';
  END IF;

  v_new_balance := v_wallet.balance - p_amount;

  UPDATE public.platform_wallets
  SET balance = v_new_balance,
      available_balance = available_balance - p_amount
  WHERE id = v_wallet.id;

  INSERT INTO public.platform_wallet_transactions (
    platform_wallet_id,
    admin_profile_id,
    transaction_type,
    reference_table,
    reference_id,
    asset_symbol,
    amount,
    direction,
    balance_before,
    balance_after,
    description
  )
  VALUES (
    v_wallet.id,
    p_admin_profile_id,
    p_transaction_type,
    p_reference_table,
    p_reference_id,
    coalesce(p_asset_symbol, 'USDT'),
    p_amount,
    'debit',
    v_wallet.balance,
    v_new_balance,
    p_description
  );

  RETURN v_wallet.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_trade(
  p_profile_id uuid,
  p_market_id uuid,
  p_side trade_side,
  p_amount numeric,
  p_price numeric,
  p_fee_amount numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_trade_id uuid;
  v_market public.markets%rowtype;
  v_units numeric(20,8);
  v_total_debit numeric(20,8);
  v_promoter_id uuid;
  v_promoter_rate numeric(5,4);
  v_commission_amount numeric(20,8);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'trade amount must be greater than zero';
  END IF;

  IF p_price <= 0 OR p_price > 1 THEN
    RAISE EXCEPTION 'trade price must be > 0 and <= 1';
  END IF;

  SELECT *
    INTO v_market
  FROM public.markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'market not found';
  END IF;

  IF v_market.status <> 'active' OR now() >= v_market.close_at THEN
    RAISE EXCEPTION 'market is not tradeable';
  END IF;

  v_total_debit := p_amount;
  v_units := p_amount / p_price;

  PERFORM public.debit_wallet(
    p_profile_id,
    v_total_debit,
    'trade_debit',
    'markets',
    p_market_id,
    'USD',
    'Trade placement'
  );

  INSERT INTO public.trades (
    profile_id,
    market_id,
    side,
    amount,
    price,
    fee_amount,
    position_units,
    status
  )
  VALUES (
    p_profile_id,
    p_market_id,
    p_side,
    p_amount,
    p_price,
    coalesce(p_fee_amount, 0),
    v_units,
    'executed'
  )
  RETURNING id INTO v_trade_id;

  INSERT INTO public.positions (
    profile_id,
    market_id,
    yes_units,
    no_units,
    avg_yes_price,
    avg_no_price,
    status
  )
  VALUES (
    p_profile_id,
    p_market_id,
    CASE WHEN p_side = 'yes' THEN v_units ELSE 0 END,
    CASE WHEN p_side = 'no' THEN v_units ELSE 0 END,
    CASE WHEN p_side = 'yes' THEN p_price ELSE NULL END,
    CASE WHEN p_side = 'no' THEN p_price ELSE NULL END,
    'open'
  )
  ON CONFLICT (profile_id, market_id)
  DO UPDATE
  SET
    yes_units = CASE
      WHEN p_side = 'yes' THEN public.positions.yes_units + excluded.yes_units
      ELSE public.positions.yes_units
    END,
    no_units = CASE
      WHEN p_side = 'no' THEN public.positions.no_units + excluded.no_units
      ELSE public.positions.no_units
    END,
    avg_yes_price = CASE
      WHEN p_side = 'yes' THEN
        (
          (coalesce(public.positions.avg_yes_price, 0) * public.positions.yes_units) +
          (excluded.avg_yes_price * excluded.yes_units)
        ) / nullif(public.positions.yes_units + excluded.yes_units, 0)
      ELSE public.positions.avg_yes_price
    END,
    avg_no_price = CASE
      WHEN p_side = 'no' THEN
        (
          (coalesce(public.positions.avg_no_price, 0) * public.positions.no_units) +
          (excluded.avg_no_price * excluded.no_units)
        ) / nullif(public.positions.no_units + excluded.no_units, 0)
      ELSE public.positions.avg_no_price
    END,
    status = 'open';

  IF coalesce(p_fee_amount, 0) > 0 THEN
    PERFORM public.debit_wallet(
      p_profile_id,
      p_fee_amount,
      'fee_debit',
      'trades',
      v_trade_id,
      'USD',
      'Platform fee'
    );

    PERFORM public.credit_platform_wallet(
      p_fee_amount,
      'fee_credit',
      'trades',
      v_trade_id,
      'USDT',
      'Platform fee collected'
    );
  END IF;

  SELECT p.referred_by_promoter_id
    INTO v_promoter_id
  FROM public.profiles p
  WHERE p.id = p_profile_id;

  IF v_promoter_id IS NOT NULL AND coalesce(p_fee_amount, 0) > 0 THEN
    SELECT commission_rate
      INTO v_promoter_rate
    FROM public.promoters
    WHERE id = v_promoter_id
      AND status = 'active';

    IF v_promoter_rate IS NOT NULL THEN
      v_commission_amount := round((p_fee_amount * v_promoter_rate)::numeric, 8);

      INSERT INTO public.commissions (
        promoter_id,
        referred_profile_id,
        trade_id,
        fee_amount_source,
        commission_rate,
        commission_amount,
        status
      )
      VALUES (
        v_promoter_id,
        p_profile_id,
        v_trade_id,
        p_fee_amount,
        v_promoter_rate,
        v_commission_amount,
        'pending'
      );

      UPDATE public.promoters
      SET total_commission_generated = total_commission_generated + v_commission_amount
      WHERE id = v_promoter_id;
    END IF;
  END IF;

  RETURN v_trade_id;
END;
$$;

SELECT public.ensure_platform_wallet('general_admin');
