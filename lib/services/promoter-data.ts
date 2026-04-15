import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PromoterDashboardSummary = {
  promoterId: string;
  profileId: string;
  displayName: string | null;
  promoCode: string;
  status: string;
  commissionRate: string;
  totalCommissionGenerated: string;
  totalReferredUsers: number;
  activeReferredUsers: number;
  pendingCommission: string;
  approvedCommission: string;
  paidCommission: string;
};

export type PromoterReferral = {
  id: string;
  referredProfileId: string;
  promoCodeUsed: string;
  createdAt: string;
};

export type PromoterCommission = {
  id: string;
  referredProfileId: string;
  tradeId: string;
  feeAmountSource: string;
  commissionRate: string;
  commissionAmount: string;
  status: string;
  createdAt: string;
};

export async function getPromoterSummaryByProfileId(
  profileId: string,
): Promise<PromoterDashboardSummary | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("v_promoter_dashboard")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as Record<string, unknown>;
  return {
    promoterId: String(row.promoter_id),
    profileId: String(row.profile_id),
    displayName: row.display_name == null ? null : String(row.display_name),
    promoCode: String(row.promo_code),
    status: String(row.status),
    commissionRate: String(row.commission_rate),
    totalCommissionGenerated: String(row.total_commission_generated),
    totalReferredUsers: Number(row.total_referred_users ?? 0),
    activeReferredUsers: Number(row.active_referred_users ?? 0),
    pendingCommission: String(row.pending_commission ?? "0"),
    approvedCommission: String(row.approved_commission ?? "0"),
    paidCommission: String(row.paid_commission ?? "0"),
  };
}

export async function getPromoterReferrals(
  promoterId: string,
  limit = 20,
): Promise<PromoterReferral[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("referrals")
    .select("id, referred_profile_id, promo_code_used, created_at")
    .eq("promoter_id", promoterId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      referredProfileId: String(r.referred_profile_id),
      promoCodeUsed: String(r.promo_code_used),
      createdAt: String(r.created_at),
    };
  });
}

export async function getPromoterCommissions(
  promoterId: string,
  limit = 30,
): Promise<PromoterCommission[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("commissions")
    .select(
      "id, referred_profile_id, trade_id, fee_amount_source, commission_rate, commission_amount, status, created_at",
    )
    .eq("promoter_id", promoterId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      referredProfileId: String(r.referred_profile_id),
      tradeId: String(r.trade_id),
      feeAmountSource: String(r.fee_amount_source),
      commissionRate: String(r.commission_rate),
      commissionAmount: String(r.commission_amount),
      status: String(r.status),
      createdAt: String(r.created_at),
    };
  });
}
