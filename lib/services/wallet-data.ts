import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WalletStatus, WalletTxType, EntryDirection } from "@/types/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletSummary = {
  id: string;
  balance: string;
  availableBalance: string;
  reservedBalance: string;
  status: WalletStatus;
};

export type WalletTransaction = {
  id: string;
  transactionType: WalletTxType;
  assetSymbol: string;
  amount: string;
  direction: EntryDirection;
  balanceBefore: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
};

export type WalletPageData = {
  wallet: WalletSummary | null;
  transactions: WalletTransaction[];
};

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

export async function getWalletData(profileId: string): Promise<WalletPageData> {
  const supabase = createSupabaseServerClient();

  const [walletRes, txRes] = await Promise.all([
    supabase
      .from("wallets")
      .select("id, balance, available_balance, reserved_balance, status")
      .eq("profile_id", profileId)
      .maybeSingle(),

    supabase
      .from("wallet_transactions")
      .select(
        "id, transaction_type, asset_symbol, amount, direction, balance_before, balance_after, description, created_at",
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  let wallet: WalletSummary | null = null;
  if (walletRes.data) {
    const w = walletRes.data as {
      id: string;
      balance: string | number;
      available_balance: string | number;
      reserved_balance: string | number;
      status: WalletStatus;
    };
    wallet = {
      id: w.id,
      balance: String(w.balance),
      availableBalance: String(w.available_balance),
      reservedBalance: String(w.reserved_balance),
      status: w.status,
    };
  }

  const transactions: WalletTransaction[] = (txRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      transaction_type: WalletTxType;
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

  return { wallet, transactions };
}
