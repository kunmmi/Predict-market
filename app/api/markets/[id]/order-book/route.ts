/**
 * GET /api/markets/[id]/order-book
 *
 * Returns aggregated open limit orders for a market, grouped by side and
 * price level. No authentication required — only totals are exposed, never
 * individual orders or user identities.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type OrderBookLevel = {
  price: number;
  totalStake: number;
  orderCount: number;
};

export type OrderBookResponse = {
  yes: OrderBookLevel[];
  no: OrderBookLevel[];
  totalOrders: number;
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("limit_orders")
    .select("side, target_price, amount_stake")
    .eq("market_id", params.id)
    .eq("status", "open");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = data ?? [];

  // Aggregate by side + price
  const buckets = new Map<string, { side: "yes" | "no"; price: number; totalStake: number; orderCount: number }>();

  for (const order of orders) {
    const price = Math.round(parseFloat(String(order.target_price)) * 1000) / 1000;
    const key = `${order.side}:${price}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.totalStake += parseFloat(String(order.amount_stake));
      existing.orderCount += 1;
    } else {
      buckets.set(key, {
        side: order.side as "yes" | "no",
        price,
        totalStake: parseFloat(String(order.amount_stake)),
        orderCount: 1,
      });
    }
  }

  const yes: OrderBookLevel[] = [];
  const no: OrderBookLevel[] = [];

  Array.from(buckets.values()).forEach((b) => {
    const level: OrderBookLevel = {
      price: b.price,
      totalStake: Math.round(b.totalStake * 100) / 100,
      orderCount: b.orderCount,
    };
    if (b.side === "yes") yes.push(level);
    else no.push(level);
  });

  // YES: highest price first (closest to filling)
  yes.sort((a, b) => b.price - a.price);
  // NO: highest price first
  no.sort((a, b) => b.price - a.price);

  const body: OrderBookResponse = { yes, no, totalOrders: orders.length };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
