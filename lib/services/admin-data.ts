import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminSummaryRow = {
  total_profiles: number | null;
  total_promoters: number | null;
  total_referrals: number | null;
  total_deposits: number | null;
  total_approved_deposits: number | null;
  total_active_markets: number | null;
  total_trades: number | null;
  total_trade_volume: string | number | null;
  total_platform_fees: string | number | null;
  total_promoter_commissions: string | number | null;
};

type AdminLogRow = {
  id: string;
  action_type: string;
  target_table: string;
  target_id: string;
  notes: string | null;
  created_at: string;
};

export type AdminDashboardData = {
  summary: {
    totalProfiles: number;
    totalPromoters: number;
    totalReferrals: number;
    totalDeposits: number;
    totalApprovedDeposits: number;
    totalActiveMarkets: number;
    totalTrades: number;
    totalTradeVolume: string;
    totalPlatformFees: string;
    totalPromoterCommissions: string;
  };
  recentAdminLogs: Array<{
    id: string;
    actionType: string;
    targetTable: string;
    targetId: string;
    notes: string | null;
    createdAt: string;
  }>;
  warning: string | null;
};

function toStr(v: string | number | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  try {
    const supabase = createSupabaseAdminClient();

    const [summaryRes, logsRes] = await Promise.all([
      supabase.from("v_admin_dashboard_summary").select("*").single(),
      supabase
        .from("admin_logs")
        .select("id, action_type, target_table, target_id, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const summaryRow = (summaryRes.data ?? {}) as Partial<AdminSummaryRow>;
    const logs = (logsRes.data ?? []) as AdminLogRow[];

    return {
      summary: {
        totalProfiles: Number(summaryRow.total_profiles ?? 0),
        totalPromoters: Number(summaryRow.total_promoters ?? 0),
        totalReferrals: Number(summaryRow.total_referrals ?? 0),
        totalDeposits: Number(summaryRow.total_deposits ?? 0),
        totalApprovedDeposits: Number(summaryRow.total_approved_deposits ?? 0),
        totalActiveMarkets: Number(summaryRow.total_active_markets ?? 0),
        totalTrades: Number(summaryRow.total_trades ?? 0),
        totalTradeVolume: toStr(summaryRow.total_trade_volume),
        totalPlatformFees: toStr(summaryRow.total_platform_fees),
        totalPromoterCommissions: toStr(summaryRow.total_promoter_commissions),
      },
      recentAdminLogs: logs.map((row) => ({
        id: row.id,
        actionType: row.action_type,
        targetTable: row.target_table,
        targetId: row.target_id,
        notes: row.notes,
        createdAt: row.created_at,
      })),
      warning: null,
    };
  } catch (error) {
    return {
      summary: {
        totalProfiles: 0,
        totalPromoters: 0,
        totalReferrals: 0,
        totalDeposits: 0,
        totalApprovedDeposits: 0,
        totalActiveMarkets: 0,
        totalTrades: 0,
        totalTradeVolume: "0",
        totalPlatformFees: "0",
        totalPromoterCommissions: "0",
      },
      recentAdminLogs: [],
      warning:
        error instanceof Error
          ? error.message
          : "Admin data is currently unavailable.",
    };
  }
}

// ---------------------------------------------------------------------------
// Admin deposits
// ---------------------------------------------------------------------------

export type AdminDepositRow = {
  id: string;
  profileId: string;
  userEmail: string;
  assetSymbol: string;
  networkName: string | null;
  amountExpected: string | null;
  amountReceived: string | null;
  txHash: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
};

export async function getAdminDeposits(
  statusFilter?: string,
): Promise<AdminDepositRow[]> {
  try {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("deposits")
      .select(
        "id, profile_id, asset_symbol, network_name, amount_expected, amount_received, tx_hash, status, admin_notes, created_at, profiles!deposits_profile_id_fkey ( email )",
      )
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getAdminDeposits] Supabase query error:", error.message, error.code);
      return [];
    }

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const profileJoin = r["profiles!deposits_profile_id_fkey"] as
        | { email?: string }
        | { email?: string }[]
        | null;

      let email = "—";
      if (Array.isArray(profileJoin)) {
        email = (profileJoin[0] as { email?: string })?.email ?? "—";
      } else if (profileJoin && typeof profileJoin === "object") {
        email = (profileJoin as { email?: string }).email ?? "—";
      }

      return {
        id: String(r.id),
        profileId: String(r.profile_id),
        userEmail: email,
        assetSymbol: String(r.asset_symbol),
        networkName: r.network_name ? String(r.network_name) : null,
        amountExpected: r.amount_expected != null ? String(r.amount_expected) : null,
        amountReceived: r.amount_received != null ? String(r.amount_received) : null,
        txHash: r.tx_hash ? String(r.tx_hash) : null,
        status: String(r.status),
        adminNotes: r.admin_notes ? String(r.admin_notes) : null,
        createdAt: String(r.created_at),
      };
    });
  } catch (err) {
    console.error("[getAdminDeposits] Unexpected error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admin commissions
// ---------------------------------------------------------------------------

export type AdminCommissionRow = {
  id: string;
  promoterId: string;
  promoterEmail: string;
  promoterPromoCode: string;
  referredProfileEmail: string;
  tradeId: string;
  feeAmountSource: string;
  commissionRate: string;
  commissionAmount: string;
  status: string;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

export async function getAdminCommissions(
  statusFilter?: string,
): Promise<AdminCommissionRow[]> {
  try {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("commissions")
      .select(
        `id, promoter_id, trade_id, fee_amount_source, commission_rate, commission_amount, status, approved_at, paid_at, created_at,
         promoters ( promo_code, profiles ( email ) ),
         referred_profile:profiles!commissions_referred_profile_id_fkey ( email )`,
      )
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const promoter = r.promoters as Record<string, unknown> | null;
      const promoterProfile = promoter?.profiles as Record<string, unknown> | { email?: string }[] | null;
      const referredProfile = r.referred_profile as Record<string, unknown> | null;

      let promoterEmail = "—";
      if (Array.isArray(promoterProfile)) {
        promoterEmail = (promoterProfile[0] as { email?: string })?.email ?? "—";
      } else if (promoterProfile && typeof promoterProfile === "object") {
        promoterEmail = (promoterProfile as { email?: string }).email ?? "—";
      }

      return {
        id: String(r.id),
        promoterId: String(r.promoter_id),
        promoterEmail,
        promoterPromoCode: String((promoter as { promo_code?: unknown } | null)?.promo_code ?? "—"),
        referredProfileEmail: referredProfile
          ? String((referredProfile as { email?: unknown }).email ?? "—")
          : "—",
        tradeId: String(r.trade_id),
        feeAmountSource: String(r.fee_amount_source ?? "0"),
        commissionRate: String(r.commission_rate ?? "0"),
        commissionAmount: String(r.commission_amount ?? "0"),
        status: String(r.status),
        approvedAt: r.approved_at ? String(r.approved_at) : null,
        paidAt: r.paid_at ? String(r.paid_at) : null,
        createdAt: String(r.created_at),
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admin users
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  kycStatus: string;
  createdAt: string;
};

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, email, display_name, role, kyc_status, created_at")
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => {
      const r = row as {
        id: string;
        email: string;
        display_name: string | null;
        role: string;
        kyc_status: string;
        created_at: string;
      };
      return {
        id: r.id,
        email: r.email,
        displayName: r.display_name,
        role: r.role,
        kycStatus: r.kyc_status,
        createdAt: r.created_at,
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admin promoters
// ---------------------------------------------------------------------------

export type AdminPromoterRow = {
  id: string;
  email: string;
  promoCode: string;
  commissionRate: string;
  status: string;
  totalEarned: string;
  createdAt: string;
};

export async function getAdminPromoters(): Promise<AdminPromoterRow[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("promoters")
      .select(
        "id, promo_code, commission_rate, status, total_earned, created_at, profiles ( email )",
      )
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => {
      const r = row as {
        id: string;
        promo_code: string;
        commission_rate: string | number;
        status: string;
        total_earned: string | number;
        created_at: string;
        profiles: { email?: string } | { email?: string }[] | null;
      };

      let email = "—";
      if (Array.isArray(r.profiles)) {
        email = (r.profiles[0] as { email?: string })?.email ?? "—";
      } else if (r.profiles && typeof r.profiles === "object") {
        email = (r.profiles as { email?: string }).email ?? "—";
      }

      return {
        id: r.id,
        email,
        promoCode: r.promo_code,
        commissionRate: String(r.commission_rate ?? "0"),
        status: r.status,
        totalEarned: String(r.total_earned ?? "0"),
        createdAt: r.created_at,
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admin referrals
// ---------------------------------------------------------------------------

export type AdminReferralRow = {
  id: string;
  promoterPromoCode: string;
  referredEmail: string;
  status: string;
  commissionPaid: string;
  createdAt: string;
};

export async function getAdminReferrals(): Promise<AdminReferralRow[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("referrals")
      .select(
        `id, status, commission_paid, created_at,
         promoters ( promo_code ),
         referred_profile:profiles!referrals_referred_profile_id_fkey ( email )`,
      )
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const promoter = r.promoters as { promo_code?: string } | null;
      const referred = r.referred_profile as { email?: string } | null;

      return {
        id: String(r.id),
        promoterPromoCode: promoter?.promo_code ?? "—",
        referredEmail: referred?.email ?? "—",
        status: String(r.status),
        commissionPaid: String(r.commission_paid ?? "0"),
        createdAt: String(r.created_at),
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admin trades
// ---------------------------------------------------------------------------

export type AdminTradeRow = {
  id: string;
  userEmail: string;
  marketTitle: string;
  side: string;
  amount: string;
  price: string;
  feeAmount: string;
  positionUnits: string;
  status: string;
  createdAt: string;
};

export async function getAdminTrades(): Promise<AdminTradeRow[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("trades")
      .select(
        `id, side, amount, price, fee_amount, position_units, status, created_at,
         profiles ( email ),
         markets ( title )`,
      )
      .order("created_at", { ascending: false })
      .limit(200);

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const profile = r.profiles as { email?: string } | null;
      const market = r.markets as { title?: string } | null;

      return {
        id: String(r.id),
        userEmail: profile?.email ?? "—",
        marketTitle: market?.title ?? "—",
        side: String(r.side),
        amount: String(r.amount ?? "0"),
        price: String(r.price ?? "0"),
        feeAmount: String(r.fee_amount ?? "0"),
        positionUnits: String(r.position_units ?? "0"),
        status: String(r.status),
        createdAt: String(r.created_at),
      };
    });
  } catch (err) {
    console.error("[getAdminDeposits] Unexpected error:", err);
    return [];
  }
}

export async function getAdminLogs(limit = 100): Promise<
  Array<{
    id: string;
    actionType: string;
    targetTable: string;
    targetId: string;
    notes: string | null;
    createdAt: string;
  }>
> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("admin_logs")
      .select("id, action_type, target_table, target_id, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    const logs = (data ?? []) as AdminLogRow[];
    return logs.map((row) => ({
      id: row.id,
      actionType: row.action_type,
      targetTable: row.target_table,
      targetId: row.target_id,
      notes: row.notes,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}
