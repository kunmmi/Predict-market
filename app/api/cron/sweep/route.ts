/**
 * POST /api/cron/sweep
 *
 * Automated USDT sweep — called by Vercel Cron twice daily (3 AM + 3 PM UTC).
 * Consolidates platform-earned USDT from all deposit addresses into the
 * master wallet without any admin action.
 *
 * Protected by Vercel's CRON_SECRET — Vercel automatically:
 *   1. Sets the CRON_SECRET environment variable on deploy.
 *   2. Passes it as `Authorization: Bearer <CRON_SECRET>` on each invocation.
 *
 * Schedule is defined in vercel.json.
 */

import { NextResponse } from "next/server";
import { runSweep } from "@/lib/services/run-sweep";

export const dynamic    = "force-dynamic";
export const maxDuration = 300; // seconds — requires Vercel Pro

export async function POST(request: Request) {
  // Verify this is a genuine Vercel Cron invocation
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // CRON_SECRET not set — log and refuse to prevent accidental open access
    console.error("[cron/sweep] CRON_SECRET env var is not set.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[cron/sweep] Unauthorized request — bad or missing CRON_SECRET.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron/sweep] Automated sweep triggered.");

  try {
    const result = await runSweep("cron");

    const { swept, errored, skipped, totalSweptUsdt } = result.summary;
    console.log(
      `[cron/sweep] Done — swept: ${swept}, errored: ${errored}, skipped: ${skipped}, total: $${totalSweptUsdt} USDT`,
    );

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/sweep] Sweep failed:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
