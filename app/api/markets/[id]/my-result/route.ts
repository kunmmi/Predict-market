/**
 * GET /api/markets/[id]/my-result
 *
 * Returns the current user's result for a specific market. Used by the
 * round-closed banner to show "You won $X" or "You lost $Y" after a
 * short-duration round resolves.
 *
 * If the market isn't settled yet, returns `pending: true` so the client
 * can keep polling for a few seconds while settlement completes.
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

  // Fetch market resolution status
  const { data: market } = await supabase
    .from("markets")
    .select("id, status, resolution_outcome, slug, duration_minutes")
    .eq("id", params.id)
    .maybeSingle();

  if (!market) {
    return NextResponse.json({ success: false, message: "Market not found" }, { status: 404 });
  }

  // Pull position(s) for this user + market
  const { data: positions } = await supabase
    .from("positions")
    .select("status, pnl_amount, yes_units, no_units")
    .eq("market_id", params.id)
    .eq("profile_id", profileId);

  const hasPosition = positions != null && positions.length > 0;

  // No trades on this market → nothing to show
  if (!hasPosition) {
    return NextResponse.json({
      success: true,
      participated: false,
      settled: market.status === "settled",
    });
  }

  // Position exists but market not settled yet — client should keep polling
  if (market.status !== "settled" || market.resolution_outcome === "unresolved") {
    return NextResponse.json({
      success: true,
      participated: true,
      pending: true,
    });
  }

  // Sum pnl across positions (usually one row per market+user)
  const pnlAmount = positions.reduce((sum, p) => sum + Number(p.pnl_amount ?? 0), 0);

  return NextResponse.json({
    success: true,
    participated: true,
    pending: false,
    settled: true,
    outcome: market.resolution_outcome, // "yes" | "no" | "void"
    pnlAmount: pnlAmount.toFixed(2),
    isWin: pnlAmount > 0,
  });
}
