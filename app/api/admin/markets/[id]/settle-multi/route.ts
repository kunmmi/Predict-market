import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  winner_outcome_id: z.string().uuid(),
  notes: z.string().max(500).optional().nullable(),
});

type Params = { params: { id: string } };

/**
 * POST /api/admin/markets/[id]/settle-multi
 * Settles a multi-outcome market by declaring one outcome the winner.
 * Calls settle_multi_market RPC which atomically:
 *   - marks the winner outcome (is_winner = true)
 *   - pays out winning positions pro-rata from the total pool
 *   - sets market status = 'settled'
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
  if (!body) {
    return NextResponse.json({ success: false, message: "Malformed request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.errors[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  // Confirm market exists and is multi
  const { data: market } = await supabase
    .from("markets")
    .select("market_type, status, title")
    .eq("id", params.id)
    .maybeSingle();

  if (!market) {
    return NextResponse.json({ success: false, message: "Market not found." }, { status: 404 });
  }
  if (market.market_type !== "multi") {
    return NextResponse.json(
      { success: false, message: "Use the standard settle endpoint for binary markets." },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc("settle_multi_market", {
    p_market_id:          params.id,
    p_winner_outcome_id:  parsed.data.winner_outcome_id,
    p_admin_profile_id:   adminProfileId,
    p_notes:              parsed.data.notes ?? null,
  });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message ?? "Settlement failed." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
