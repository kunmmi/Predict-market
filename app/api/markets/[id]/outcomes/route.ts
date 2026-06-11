import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("market_outcomes")
    .select("id, market_id, label, label_zh, slug, pool_amount, price, is_winner, sort_order")
    .eq("market_id", params.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json([], { status: 200 });

  const outcomes = (data ?? []).map((row) => ({
    id: row.id,
    marketId: row.market_id,
    label: row.label,
    labelZh: row.label_zh ?? null,
    slug: row.slug,
    poolAmount: Number(row.pool_amount),
    price: Number(row.price),
    isWinner: row.is_winner ?? null,
    sortOrder: Number(row.sort_order),
  }));

  return NextResponse.json(outcomes);
}
