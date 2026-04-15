import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const rejectSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/withdrawals/[id]/reject
 * Body: { notes?: string }
 *
 * Calls the reject_withdrawal DB function which:
 *   - marks withdrawal as rejected (no wallet debit)
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
  const parsed = rejectSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid input." }, { status: 400 });
  }

  const { notes } = parsed.data;

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("reject_withdrawal", {
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
