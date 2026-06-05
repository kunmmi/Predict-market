import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { getPromoterSummaryByProfileId } from "@/lib/services/promoter-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/promoters/claim-commissions
 *
 * Claims all pending commissions for the authenticated promoter, crediting
 * the sum directly to their wallet balance.
 *
 * The DB function `claim_commissions` handles the full atomic flow:
 *   - sum pending commissions
 *   - mark them paid
 *   - call credit_wallet
 *
 * Returns: { success: true, claimed: number }  (claimed = 0 if nothing pending)
 */
export async function POST() {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }

  const summary = await getPromoterSummaryByProfileId(profileId);
  if (!summary) {
    return NextResponse.json({ error: "Promoter profile not found." }, { status: 404 });
  }

  const pendingAmount = parseFloat(summary.pendingCommission ?? "0");
  if (pendingAmount <= 0) {
    return NextResponse.json({ success: true, claimed: 0 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_commissions", {
    p_promoter_id: summary.promoterId,
  });

  if (error) {
    console.error("[claim-commissions] RPC error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const claimed = Number(data ?? 0);
  return NextResponse.json({ success: true, claimed });
}
