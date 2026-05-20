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

  const { data: market } = await supabase
    .from("markets")
    .select("id, status, latest_yes_price, duration_minutes")
    .eq("id", params.id)
    .maybeSingle();

  if (!market) {
    return NextResponse.json({ success: false, message: "Market not found." }, { status: 404 });
  }
  if (market.status !== "active") {
    return NextResponse.json({ success: false, message: "Market is not active." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const providedPrice = typeof body?.current_yes_price === "number" ? body.current_yes_price : null;
  const yesPrice = providedPrice ?? (market.latest_yes_price != null ? Number(market.latest_yes_price) : 0.5);

  const result = await seedMarketMakerOrders(params.id, yesPrice);

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
