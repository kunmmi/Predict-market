import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WithdrawalStatus, DepositAssetSymbol } from "@/types/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WithdrawalSummary = {
  id: string;
  assetSymbol: DepositAssetSymbol;
  networkName: string | null;
  amount: string;
  withdrawalAddress: string;
  txHash: string | null;
  status: WithdrawalStatus;
  adminNotes: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
};

export type AdminWithdrawalRow = {
  id: string;
  profileId: string;
  userEmail: string;
  assetSymbol: string;
  networkName: string | null;
  amount: string;
  withdrawalAddress: string;
  status: string;
  adminNotes: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// User-facing
// ---------------------------------------------------------------------------

export async function getUserWithdrawals(profileId: string): Promise<WithdrawalSummary[]> {
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("withdrawals")
    .select(
      "id, asset_symbol, network_name, amount, withdrawal_address, tx_hash, status, admin_notes, approved_at, rejected_at, created_at",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      asset_symbol: DepositAssetSymbol;
      network_name: string | null;
      amount: string | number;
      withdrawal_address: string;
      tx_hash: string | null;
      status: WithdrawalStatus;
      admin_notes: string | null;
      approved_at: string | null;
      rejected_at: string | null;
      created_at: string;
    };
    return {
      id: r.id,
      assetSymbol: r.asset_symbol,
      networkName: r.network_name,
      amount: String(r.amount),
      withdrawalAddress: r.withdrawal_address,
      txHash: r.tx_hash,
      status: r.status,
      adminNotes: r.admin_notes,
      approvedAt: r.approved_at,
      rejectedAt: r.rejected_at,
      createdAt: r.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Admin-facing
// ---------------------------------------------------------------------------

export async function getAdminWithdrawals(statusFilter?: string): Promise<AdminWithdrawalRow[]> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("withdrawals")
    .select(
      "id, profile_id, amount, asset_symbol, network_name, withdrawal_address, status, admin_notes, approved_at, rejected_at, created_at, profiles!withdrawals_profile_id_fkey ( email )",
    )
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getAdminWithdrawals] Supabase query error:", error.message, error.code);
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      profile_id: string;
      amount: string | number;
      asset_symbol: string;
      network_name: string | null;
      withdrawal_address: string;
      status: string;
      admin_notes: string | null;
      approved_at: string | null;
      rejected_at: string | null;
      created_at: string;
      "profiles!withdrawals_profile_id_fkey": { email: string } | null;
    };
    return {
      id: r.id,
      profileId: r.profile_id,
      userEmail: r["profiles!withdrawals_profile_id_fkey"]?.email ?? "Unknown",
      assetSymbol: r.asset_symbol,
      networkName: r.network_name,
      amount: String(r.amount),
      withdrawalAddress: r.withdrawal_address,
      status: r.status,
      adminNotes: r.admin_notes,
      approvedAt: r.approved_at,
      rejectedAt: r.rejected_at,
      createdAt: r.created_at,
    };
  });
}
