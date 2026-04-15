import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DepositStatus, DepositAssetSymbol } from "@/types/enums";

export type DepositSummary = {
  id: string;
  assetSymbol: DepositAssetSymbol;
  networkName: string | null;
  amountExpected: string | null;
  amountReceived: string | null;
  txHash: string | null;
  status: DepositStatus;
  adminNotes: string | null;
  approvedAt: string | null;
  createdAt: string;
};

export async function getUserDeposits(profileId: string): Promise<DepositSummary[]> {
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("deposits")
    .select(
      "id, asset_symbol, network_name, amount_expected, amount_received, tx_hash, status, admin_notes, approved_at, created_at",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      asset_symbol: DepositAssetSymbol;
      network_name: string | null;
      amount_expected: string | number | null;
      amount_received: string | number | null;
      tx_hash: string | null;
      status: DepositStatus;
      admin_notes: string | null;
      approved_at: string | null;
      created_at: string;
    };
    return {
      id: r.id,
      assetSymbol: r.asset_symbol,
      networkName: r.network_name,
      amountExpected: r.amount_expected != null ? String(r.amount_expected) : null,
      amountReceived: r.amount_received != null ? String(r.amount_received) : null,
      txHash: r.tx_hash,
      status: r.status,
      adminNotes: r.admin_notes,
      approvedAt: r.approved_at,
      createdAt: r.created_at,
    };
  });
}
