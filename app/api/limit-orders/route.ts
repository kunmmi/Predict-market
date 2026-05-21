/**
 * Limit orders API.
 *
 *   POST /api/limit-orders        — place a new limit order
 *   GET  /api/limit-orders        — list current user's orders
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Same fee rate the trade form uses, applied server-side as well so the
// reservation matches what's later debited at fill time.
const FEE_RATE = 0.025;

const placeBodySchema = z.object({
  market_id: z.string().uuid(),
  side: z.enum(["yes", "no"]),
  amount: z.union([z.string(), z.number()]).transform((v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return n;
  }).refine((n) => Number.isFinite(n) && n > 0 && n <= 100, "Amount must be > 0 and ≤ 100"),
  target_price: z.union([z.string(), z.number()]).transform((v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return n;
  }).refine((n) => Number.isFinite(n) && n > 0 && n < 1, "Target price must be between 0 and 1 (exclusive)"),
});

// ---------------------------------------------------------------------------
// POST — place a limit order
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = placeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { market_id, side, amount, target_price } = parsed.data;
  const fee = Math.round(amount * FEE_RATE * 1_000_000) / 1_000_000;

  const supabase = createSupabaseAdminClient();

  // Quick sanity check: market must still be active and tradeable
  const { data: market } = await supabase
    .from("markets")
    .select("id, status, close_at, cutoff_at")
    .eq("id", market_id)
    .maybeSingle();

  if (!market) {
    return NextResponse.json({ success: false, message: "Market not found" }, { status: 404 });
  }
  if (market.status !== "active") {
    return NextResponse.json({ success: false, message: "Market is not active" }, { status: 400 });
  }
  if (new Date(market.cutoff_at ?? market.close_at).getTime() <= Date.now()) {
    return NextResponse.json({ success: false, message: "Predictions are closed for this round" }, { status: 400 });
  }

  const { data: orderId, error } = await supabase.rpc("place_limit_order", {
    p_profile_id: profileId,
    p_market_id: market_id,
    p_side: side,
    p_amount: amount,
    p_target_price: target_price,
    p_fee_amount: fee,
  });

  if (error) {
    // place_limit_order raises 'Insufficient available balance for limit order.'
    const message = error.message?.includes("Insufficient")
      ? "Insufficient available balance."
      : error.message ?? "Failed to place limit order";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  return NextResponse.json({ success: true, orderId });
}

// ---------------------------------------------------------------------------
// GET — list user's limit orders (optionally filtered by status)
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // optional: open|filled|cancelled|expired

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("limit_orders")
    .select(`
      id, market_id, side, amount_stake, fee_amount, target_price, status,
      filled_at_price, filled_trade_id, created_at, filled_at, cancelled_at,
      markets!inner(title, title_zh, slug, asset_symbol, duration_minutes, close_at, status)
    `)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && ["open", "filled", "cancelled", "expired"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, orders: data ?? [] });
}
