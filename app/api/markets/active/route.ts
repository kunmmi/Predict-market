import { NextResponse } from "next/server";

import { settleShortDurationMarketById } from "@/lib/services/short-duration-settlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function findLiveMarket(supabase: ReturnType<typeof createSupabaseAdminClient>, asset: string) {
  return supabase
    .from("markets")
    .select("id, slug, asset_symbol, close_at, duration_minutes")
    .eq("asset_symbol", asset)
    .eq("status", "active")
    .not("duration_minutes", "is", null)
    .gt("close_at", new Date().toISOString())
    .order("close_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset")?.trim().toUpperCase();

  if (!asset) {
    return NextResponse.json(
      { success: false, message: "asset is required." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  let { data, error } = await findLiveMarket(supabase, asset);

  if (!data && !error) {
    const expired = await supabase
      .from("markets")
      .select("id")
      .eq("asset_symbol", asset)
      .eq("status", "active")
      .not("duration_minutes", "is", null)
      .lte("close_at", new Date().toISOString())
      .order("close_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (expired.data?.id) {
      await settleShortDurationMarketById(expired.data.id as string);
      const live = await findLiveMarket(supabase, asset);
      data = live.data;
      error = live.error;
    }
  }

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message ?? "Failed to find active market." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { success: false, message: "No live market is available yet." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    id: data.id,
    slug: data.slug,
    assetSymbol: data.asset_symbol,
    closeAt: data.close_at,
  });
}
