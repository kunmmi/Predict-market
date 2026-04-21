import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendDepositRejectedEmail } from "@/lib/services/email-notifications";

const rejectSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/deposits/[id]/reject
 * Body: { notes?: string }
 *
 * Calls the reject_deposit DB function which:
 *   - marks deposit as rejected
 *   - writes an admin_log entry
 *   - does NOT touch the wallet
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let adminProfileId: string;
  try {
    const { profile } = await requireAdminForApi();
    adminProfileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => undefined);
  const parsed = rejectSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid input." }, { status: 400 });
  }

  const { notes } = parsed.data;

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("reject_deposit", {
      p_deposit_id: params.id,
      p_admin_profile_id: adminProfileId,
      p_admin_notes: notes ?? null,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 },
      );
    }

    // Fetch user details for the email notification (non-blocking)
    const { data: deposit } = await supabase
      .from("deposits")
      .select("amount_expected, asset_symbol, profiles(email, full_name)")
      .eq("id", params.id)
      .maybeSingle();

    if (deposit) {
      const profile = Array.isArray(deposit.profiles) ? deposit.profiles[0] : deposit.profiles;
      sendDepositRejectedEmail({
        toEmail: profile?.email ?? "",
        toName: profile?.full_name ?? null,
        amount: deposit.amount_expected ? Number(deposit.amount_expected) : null,
        assetSymbol: deposit.asset_symbol,
        notes: notes ?? null,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
