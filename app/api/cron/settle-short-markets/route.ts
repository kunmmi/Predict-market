import { NextResponse } from "next/server";

import { settleExpiredShortDurationMarkets } from "@/lib/services/short-duration-settlement";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const results = await settleExpiredShortDurationMarkets();
    const settled = results.filter((entry) => entry.result.success && !entry.result.already).length;
    const already = results.filter((entry) => entry.result.success && entry.result.already).length;
    const failed = results.filter((entry) => !entry.result.success).length;

    return NextResponse.json(
      {
        success: true,
        checked: results.length,
        settled,
        already,
        failed,
        results,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Short-duration market settlement sweep failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
