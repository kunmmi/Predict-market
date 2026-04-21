import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSettleSchema } from "@/lib/validations/settlement";
import { sendMarketSettledEmails } from "@/lib/services/email-notifications";

type Params = { params: { id: string } };

/**
 * POST /api/admin/markets/[id]/settle
 * Calls the settle_market RPC function.
 * settle_market(p_market_id, p_resolution, p_admin_profile_id, p_notes)
 */
export async function POST(request: Request, { params }: Params) {
  let adminProfileId: string;
  try {
    const { profile } = await requireAdminForApi();
    adminProfileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json(
      { success: false, message: "Malformed JSON body." },
      { status: 400 },
    );
  }

  const parsed = marketSettleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { resolution, notes } = parsed.data;

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.rpc("settle_market", {
    p_market_id: params.id,
    p_resolution: resolution,
    p_admin_profile_id: adminProfileId,
    p_notes: notes ?? null,
  });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message ?? "Failed to settle market." },
      { status: 400 },
    );
  }

  // Notify all users who had an open position in this market (non-blocking)
  void (async () => {
    try {
      const { data: market } = await supabase
        .from("markets")
        .select("title")
        .eq("id", params.id)
        .maybeSingle();

      if (!market) return;

      const { data: positions } = await supabase
        .from("positions")
        .select("profiles(email, full_name)")
        .eq("market_id", params.id);

      if (!positions?.length) return;

      const users = positions.flatMap((p) => {
        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        return profile?.email ? [{ email: profile.email, name: profile.full_name ?? null }] : [];
      });

      await sendMarketSettledEmails({ users, marketTitle: market.title, outcome: resolution });
    } catch {
      // non-blocking — email failure must never affect the response
    }
  })();

  return NextResponse.json({ success: true }, { status: 200 });
}
