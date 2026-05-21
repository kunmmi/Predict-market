/**
 * GET /api/markets/[id]/my-position
 *
 * Returns the authenticated user's open position on a specific market.
 * Used by the market detail page to show live holdings without a full
 * portfolio fetch.
 */

import { NextResponse } from "next/server";
import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: position } = await supabase
    .from("positions")
    .select("yes_units, no_units, avg_yes_price, avg_no_price, status")
    .eq("market_id", params.id)
    .eq("profile_id", profileId)
    .eq("status", "open")
    .maybeSingle();

  if (!position) {
    return NextResponse.json({ success: true, hasPosition: false });
  }

  return NextResponse.json({
    success: true,
    hasPosition: true,
    yesUnits: Number(position.yes_units ?? 0),
    noUnits: Number(position.no_units ?? 0),
    avgYesPrice: position.avg_yes_price != null ? Number(position.avg_yes_price) : null,
    avgNoPrice: position.avg_no_price != null ? Number(position.avg_no_price) : null,
  });
}
