/**
 * POST /api/admin/markets/[id]/seed-orders
 *
 * Places (or refreshes) house market-maker orders for a market.
 * Accepts an optional current_yes_price in the body; falls back to the
 * market's stored latest_yes_price if omitted.
 */

import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { seedMarketMakerOrders } from "@/lib/services/market-maker";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .select("id, status, duration_minutes, market_prices(yes_price, created_at)")
    .eq("id", params.id)
    .order("created_at", { referencedTable: "market_prices", ascending: false })
    .limit(1, { referencedTable: "market_prices" })
    .maybeSingle();

  if (marketError || !market) {
    return NextResponse.json({ success: false, message: "Market not found." }, { status: 404 });
  }
  if (market.status !== "active") {
    return NextResponse.json({ success: false, message: "Market is not active." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const providedPrice = typeof body?.current_yes_price === "number" ? body.current_yes_price : null;
  const latestPrice = Array.isArray(market.market_prices) && market.market_prices.length > 0
    ? Number(market.market_prices[0].yes_price)
    : null;
  const yesPrice = providedPrice ?? latestPrice ?? 0.5;

  const result = await seedMarketMakerOrders(params.id, yesPrice);

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
