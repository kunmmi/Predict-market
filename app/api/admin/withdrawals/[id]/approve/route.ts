import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const approveSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/withdrawals/[id]/approve
 * Body: { notes?: string }
 *
 * Calls the approve_withdrawal DB function which:
 *   - debits the user's wallet
 *   - marks withdrawal as approved
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

  const body = await request.json().catch(() => ({}));
  const parsed = approveSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid input." }, { status: 400 });
  }

  const { notes } = parsed.data;

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("approve_withdrawal", {
      p_withdrawal_id: params.id,
      p_admin_profile_id: adminProfileId,
      p_admin_notes: notes ?? null,
    });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
