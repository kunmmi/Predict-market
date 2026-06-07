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
    .select("status, pnl_amount, yes_units, no_units, avg_yes_price, avg_no_price")
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

  // Compute actual P&L: pnl_amount stores the raw payout (0 for a loss).
  // For wins: use pnl_amount directly (set by settle_market RPC).
  // For losses: use actual wallet trade_debits minus any sell credits for this
  // market — this is the true cost basis, immune to stale avg_yes_price values.
  const isVoidOutcome = market.resolution_outcome === "void" || market.resolution_outcome === "cancelled";

  const totalPayout = positions.reduce((sum, p) => sum + Number(p.pnl_amount ?? 0), 0);

  let pnlAmount: number;
  if (isVoidOutcome) {
    pnlAmount = 0;
  } else if (totalPayout > 0) {
    pnlAmount = totalPayout; // win
  } else {
    // Loss — derive true cost from wallet transactions (most reliable source)
    const { data: txRows } = await supabase
      .from("wallet_transactions")
      .select("transaction_type, amount")
      .eq("profile_id", profileId)
      .eq("reference_table", "markets")
      .eq("reference_id", params.id);

    const debits  = (txRows ?? []).filter(t => t.transaction_type === "trade_debit").reduce((s, t) => s + Number(t.amount), 0);
    const credits = (txRows ?? []).filter(t => t.transaction_type === "trade_credit").reduce((s, t) => s + Number(t.amount), 0);
    pnlAmount = -(debits - credits); // negative = loss
  }

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
