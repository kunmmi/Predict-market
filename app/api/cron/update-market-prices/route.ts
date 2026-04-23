import { NextResponse } from "next/server";

import { updateAllMarketPrices } from "@/lib/services/market-price-updater";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const results = await updateAllMarketPrices();
    const updated = results.filter((result) => result.updated).length;

    return NextResponse.json({
      success: true,
      updated,
      skipped: results.length - updated,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market price update failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
