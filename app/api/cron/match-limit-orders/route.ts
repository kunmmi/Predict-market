/**
 * GET /api/cron/match-limit-orders
 *
 * Iterates through all open limit orders and fires any whose target price
 * has been hit by the current live market price.
 *
 * For short-duration markets, current price is computed from Binance spot +
 * the same Black-Scholes formula the trade form uses.
 *
 * Should run frequently (every 30-60 seconds via cron-job.org).
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBinanceSpotPrice } from "@/lib/services/binance-price";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import {
  computeBinaryYesPrice,
  getPredictionDirectionFromTradeSide,
  getRewardPreview,
  getShortDurationCutoffAt,
} from "@/lib/short-duration-predictions";

export const dynamic = "force-dynamic";

const OVERROUND = 0.04;
const applyOverround = (p: number) => Math.max(0.01, Math.min(0.99, p * (1 + OVERROUND)));

type LimitOrderRow = {
  id: string;
  profile_id: string;
  market_id: string;
  side: "yes" | "no";
  amount_stake: string;
  fee_amount: string;
  target_price: string;
};

type MarketRow = {
  id: string;
  asset_symbol: string;
  status: string;
  close_at: string;
  cutoff_at: string | null;
  spot_price_at_open: string | null;
  duration_minutes: number | null;
  latest_yes_price: string | null;
  latest_no_price: string | null;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createSupabaseAdminClient();

  // Pull all open orders
  const { data: orders, error: ordersErr } = await supabase
    .from("limit_orders")
    .select("id, profile_id, market_id, side, amount_stake, fee_amount, target_price")
    .eq("status", "open");

  if (ordersErr) {
    return NextResponse.json({ error: ordersErr.message }, { status: 500 });
  }
  if (!orders || orders.length === 0) {
    return NextResponse.json({ checked: 0, filled: 0, expired: 0 });
  }

  // Bulk-fetch markets referenced by these orders
  const marketIds = Array.from(new Set(orders.map((o) => o.market_id)));
  const { data: markets } = await supabase
    .from("markets")
    .select("id, asset_symbol, status, close_at, cutoff_at, spot_price_at_open, duration_minutes, latest_yes_price, latest_no_price")
    .in("id", marketIds);

  const marketsById = new Map<string, MarketRow>(
    (markets ?? []).map((m) => [m.id as string, m as MarketRow]),
  );

  // Cache Binance spot prices per asset for the duration of this sweep
  const spotPriceCache = new Map<string, number>();
  async function getSpot(asset: string): Promise<number | null> {
    const sym = ASSET_TO_BINANCE[asset];
    if (!sym) return null;
    if (spotPriceCache.has(sym)) return spotPriceCache.get(sym)!;
    try {
      const price = await getBinanceSpotPrice(sym);
      spotPriceCache.set(sym, price);
      return price;
    } catch {
      return null;
    }
  }

  let filled = 0;
  let expired = 0;
  const errors: string[] = [];

  for (const o of orders as LimitOrderRow[]) {
    const market = marketsById.get(o.market_id);
    if (!market) continue;

    const now = Date.now();
    const closeAtMs = new Date(market.close_at).getTime();
    const cutoffAtMs = new Date(market.cutoff_at ?? market.close_at).getTime();

    // Market is over / past cutoff → expire this order
    if (market.status !== "active" || now >= cutoffAtMs) {
      const { error: cancelErr } = await supabase.rpc("cancel_limit_order", {
        p_order_id: o.id,
        p_profile_id: o.profile_id,
        p_reason: now >= closeAtMs ? "market_closed" : "past_cutoff",
      });
      if (cancelErr) {
        errors.push(`cancel(${o.id}): ${cancelErr.message}`);
      } else {
        expired += 1;
      }
      continue;
    }

    // Compute current YES/NO price for this market
    let currentYes: number | null = null;
    let currentSpot: number | null = null;

    if (market.duration_minutes != null) {
      // Short-duration: compute live price from Binance + formula + overround
      currentSpot = await getSpot(market.asset_symbol);
      if (currentSpot == null || market.spot_price_at_open == null) continue;
      const secondsRemaining = Math.max(0, Math.floor((closeAtMs - now) / 1000));
      const fairYes = computeBinaryYesPrice({
        currentSpotPrice: currentSpot,
        openingSpotPrice: Number(market.spot_price_at_open),
        secondsRemaining,
        recentCandles: [], // empty fallback — vol estimate uses default
      });
      currentYes = applyOverround(fairYes);
    } else {
      // Regular market: use the admin-set latest price
      const adminYes = market.latest_yes_price != null ? Number(market.latest_yes_price) : null;
      if (adminYes == null) continue;
      currentYes = applyOverround(adminYes);
    }

    if (currentYes == null) continue;
    const currentSidePrice = o.side === "yes"
      ? currentYes
      : applyOverround(1 - (currentYes / (1 + OVERROUND)));

    const target = Number(o.target_price);

    // Order fires when the current price has dropped to (or below) the target
    if (currentSidePrice > target) continue;

    // Eligible to fill — build trade params and call fill_limit_order
    let rpcArgs: Record<string, unknown> = {
      p_order_id: o.id,
      p_actual_price: currentSidePrice,
    };

    if (market.duration_minutes != null && currentSpot != null && market.spot_price_at_open != null) {
      const secondsRemaining = Math.max(0, Math.floor((closeAtMs - now) / 1000));
      const direction = getPredictionDirectionFromTradeSide(o.side);
      const reward = getRewardPreview({
        closesAt: market.close_at,
        cutoffAt: market.cutoff_at ?? getShortDurationCutoffAt(market.close_at).toISOString(),
        now,
        direction,
        confidencePrice: currentSidePrice,
        currentSpotPrice: currentSpot,
        openingSpotPrice: Number(market.spot_price_at_open),
      });
      rpcArgs = {
        ...rpcArgs,
        p_entry_spot_price: currentSpot,
        p_round_open_price: Number(market.spot_price_at_open),
        p_time_remaining_seconds: secondsRemaining,
        p_reward_multiplier: reward.multiplier,
        p_prediction_direction: direction,
      };
    }

    const { error: fillErr } = await supabase.rpc("fill_limit_order", rpcArgs);
    if (fillErr) {
      errors.push(`fill(${o.id}): ${fillErr.message}`);
    } else {
      filled += 1;
      console.log(`[match-limit-orders] Filled order ${o.id} at ${currentSidePrice} (target ${target})`);
    }
  }

  return NextResponse.json({
    checked: orders.length,
    filled,
    expired,
    errors,
    timestamp: new Date().toISOString(),
  });
}
