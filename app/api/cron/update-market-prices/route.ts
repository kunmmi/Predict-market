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
    // Return 200 so the GitHub Actions workflow doesn't spam failure emails.
    // A price-update failure (usually CoinGecko rate-limiting) is non-critical —
    // short-duration markets are unaffected and long-duration market prices simply
    // stay at their last known values until the next successful run.
    const message = error instanceof Error ? error.message : "Market price update failed.";
    console.error("[update-market-prices] cron error:", message);
    return NextResponse.json({ success: false, message, timestamp: new Date().toISOString() });
  }
}
