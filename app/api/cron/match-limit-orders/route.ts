/**
 * GET /api/cron/match-limit-orders
 *
 * Cron safety-net sweep: checks all open limit orders across all active
 * markets and fills any whose target price has been hit.
 *
 * The primary matching path is now event-driven — triggered inside
 * `updatePriceAfterTrade` immediately after every buy or sell. This cron
 * runs as a fallback to catch any orders that slipped through (e.g. markets
 * with no recent user trades).
 *
 * Should run every 30–60 seconds via cron-job.org.
 * Protected by CRON_SECRET.
 */

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { matchAllOpenLimitOrders } from "@/lib/services/limit-order-matcher";

export async function GET(request: Request) {
  // Fail closed: reject if CRON_SECRET is unset or the bearer token doesn't match.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await matchAllOpenLimitOrders();

  return NextResponse.json({
    ...result,
    timestamp: new Date().toISOString(),
  });
}
