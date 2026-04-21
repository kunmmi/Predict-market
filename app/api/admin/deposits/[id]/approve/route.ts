import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendDepositApprovedEmail } from "@/lib/services/email-notifications";

const approveSchema = z.object({
  amountReceived: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "Must be a positive number.")
    .refine((v) => Number.parseFloat(v) > 0, "Amount must be greater than zero."),
  notes: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/deposits/[id]/approve
 * Body: { amountReceived: string, notes?: string }
 *
 * Calls the approve_deposit DB function which:
 *   - marks deposit as approved
 *   - credits the user's wallet
 *   - writes an admin_log entry
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
  if (!body) {
    return NextResponse.json({ success: false, message: "Malformed request." }, { status: 400 });
  }

  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid input.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { amountReceived, notes } = parsed.data;

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("approve_deposit", {
      p_deposit_id: params.id,
      p_admin_profile_id: adminProfileId,
      p_amount_received: Number.parseFloat(amountReceived),
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
      .select("amount_received, asset_symbol, profiles(email, full_name)")
      .eq("id", params.id)
      .maybeSingle();

    if (deposit) {
      const profile = Array.isArray(deposit.profiles) ? deposit.profiles[0] : deposit.profiles;
      sendDepositApprovedEmail({
        toEmail: profile?.email ?? "",
        toName: profile?.full_name ?? null,
        amount: Number(deposit.amount_received ?? parsed.data.amountReceived),
        assetSymbol: deposit.asset_symbol,
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
