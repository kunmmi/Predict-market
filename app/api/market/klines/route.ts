/**
 * GET /api/market/klines?symbol=BTCUSDT&interval=1m&limit=120
 *
 * Server-side proxy for Binance klines, so the chart works for users behind
 * firewalls that block api.binance.com (e.g. mainland China).
 *
 * Uses Vercel Edge runtime for lower latency + different egress IPs that
 * are less likely to be rate-limited by Binance.
 */

import { NextResponse } from "next/server";

// Edge runtime tends to have more reliable outbound to Binance
// and gives us global low-latency for the proxy.
export const runtime = "edge";
export const dynamic = "force-dynamic";

// Endpoints in priority order. `data-api.binance.vision` is Binance's
// dedicated public market-data API — designed for unauthenticated reads,
// most lenient on rate limits.
const ENDPOINTS = [
  "https://data-api.binance.vision/api/v3/klines",
  "https://api.binance.com/api/v3/klines",
  "https://api1.binance.com/api/v3/klines",
  "https://api2.binance.com/api/v3/klines",
  "https://api3.binance.com/api/v3/klines",
  "https://api4.binance.com/api/v3/klines",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol");
  const interval = url.searchParams.get("interval") ?? "1m";
  const limit = url.searchParams.get("limit") ?? "120";

  if (!symbol || !/^[A-Z0-9]{2,20}$/i.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  if (!/^(1m|3m|5m|15m|30m|1h|4h|1d)$/.test(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }
  const limitNum = parseInt(limit, 10);
  if (!Number.isFinite(limitNum) || limitNum < 1 || limitNum > 1000) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  const query = `?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limitNum}`;
  const errors: string[] = [];

  for (const base of ENDPOINTS) {
    try {
      const res = await fetch(`${base}${query}`, {
        cache: "no-store",
        headers: {
          // Some Binance endpoints reject requests without a UA
          "User-Agent": "Mozilla/5.0 (compatible; PredictMarket/1.0)",
          Accept: "application/json",
        },
        // 6s timeout via AbortSignal
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) {
        errors.push(`${base} → ${res.status}`);
        continue;
      }
      const data = await res.json();
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=1, stale-while-revalidate=10",
        },
      });
    } catch (err) {
      errors.push(`${base} → ${err instanceof Error ? err.message : "error"}`);
    }
  }

  console.error("[/api/market/klines] All endpoints failed:", errors);
  return NextResponse.json(
    { error: "All Binance endpoints failed", details: errors },
    { status: 502 },
  );
}
