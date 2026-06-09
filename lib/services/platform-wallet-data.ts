import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WalletStatus, EntryDirection } from "@/types/enums";

export type PlatformWalletSummary = {
  id: string;
  walletKey: string;
  balance: string;
  availableBalance: string;
  reservedBalance: string;
  status: WalletStatus;
};

export type PlatformWalletTransaction = {
  id: string;
  transactionType: string;
  assetSymbol: string;
  amount: string;
  direction: EntryDirection;
  balanceBefore: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
};

export type PlatformWalletPageData = {
  wallet: PlatformWalletSummary | null;
  totalUserBalances: string;
  transactions: PlatformWalletTransaction[];
};

async function ensurePlatformWallet() {
  const supabase = createSupabaseAdminClient();

  const existing = await supabase
    .from("platform_wallets")
    .select("id, wallet_key, balance, available_balance, reserved_balance, status")
    .eq("wallet_key", "general_admin")
    .maybeSingle();

  if (existing.data) {
    return existing.data;
  }

  const inserted = await supabase
    .from("platform_wallets")
    .insert({ wallet_key: "general_admin" })
    .select("id, wallet_key, balance, available_balance, reserved_balance, status")
    .single();

  if (inserted.error) {
    throw new Error(inserted.error.message ?? "Failed to create platform wallet.");
  }

  return inserted.data;
}

export async function getPlatformWalletData(): Promise<PlatformWalletPageData> {
  const supabase = createSupabaseAdminClient();
  const walletRow = await ensurePlatformWallet();

  const [txRes, userBalRes] = await Promise.all([
    supabase
      .from("platform_wallet_transactions")
      .select(
        "id, transaction_type, asset_symbol, amount, direction, balance_before, balance_after, description, created_at",
      )
      .eq("platform_wallet_id", walletRow.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("wallets").select("balance"),
  ]);

  const totalUserBalances = String(
    (userBalRes.data ?? []).reduce(
      (sum, row) => sum + parseFloat(String((row as { balance: string | number }).balance ?? 0)),
      0,
    ).toFixed(2),
  );

  const wallet: PlatformWalletSummary = {
    id: String(walletRow.id),
    walletKey: String(walletRow.wallet_key),
    balance: String(walletRow.balance),
    availableBalance: String(walletRow.available_balance),
    reservedBalance: String(walletRow.reserved_balance),
    status: walletRow.status as WalletStatus,
  };

  const transactions: PlatformWalletTransaction[] = (txRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      transaction_type: string;
      asset_symbol: string;
      amount: string | number;
      direction: EntryDirection;
      balance_before: string | number;
      balance_after: string | number;
      description: string | null;
      created_at: string;
    };

    return {
      id: r.id,
      transactionType: r.transaction_type,
      assetSymbol: r.asset_symbol,
      amount: String(r.amount),
      direction: r.direction,
      balanceBefore: String(r.balance_before),
      balanceAfter: String(r.balance_after),
      description: r.description,
      createdAt: r.created_at,
    };
  });

  return { wallet, totalUserBalances, transactions };
}
