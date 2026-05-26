/**
 * Limit order matching service.
 *
 * Extracted from the /api/cron/match-limit-orders route so it can be called
 * both by the cron sweep (all markets) AND event-driven after every trade
 * (single market) for near-instant fills — matching how Polymarket works.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBinanceSpotPrice } from "@/lib/services/binance-price";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { OVERROUND } from "@/lib/config/trading-constants";
import {
  computeBinaryYesPrice,
  getPredictionDirectionFromTradeSide,
  getRewardPreview,
  getShortDurationCutoffAt,
} from "@/lib/short-duration-predictions";

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
};

export type MatchResult = {
  checked: number;
  filled: number;
  expired: number;
  errors: string[];
};

/**
 * Match open limit orders for a single market.
 * Called event-driven after every trade so orders fill near-instantly.
 */
export async function matchLimitOrdersForMarket(marketId: string): Promise<MatchResult> {
  return runMatcher({ marketId });
}

/**
 * Match all open limit orders across all active markets.
 * Called by the cron sweep as a safety net / fallback.
 */
export async function matchAllOpenLimitOrders(): Promise<MatchResult> {
  return runMatcher({});
}

async function runMatcher({ marketId }: { marketId?: string }): Promise<MatchResult> {
  const supabase = createSupabaseAdminClient();

  // Pull open orders (optionally scoped to a single market)
  let query = supabase
    .from("limit_orders")
    .select("id, profile_id, market_id, side, amount_stake, fee_amount, target_price")
    .eq("status", "open");

  if (marketId) {
    query = query.eq("market_id", marketId);
  }

  const { data: orders, error: ordersErr } = await query;

  if (ordersErr) {
    return { checked: 0, filled: 0, expired: 0, errors: [ordersErr.message] };
  }
  if (!orders || orders.length === 0) {
    return { checked: 0, filled: 0, expired: 0, errors: [] };
  }

  // Bulk-fetch the referenced markets
  const marketIds = Array.from(new Set(orders.map((o) => o.market_id)));
  const { data: markets } = await supabase
    .from("markets")
    .select(
      "id, asset_symbol, status, close_at, cutoff_at, spot_price_at_open, duration_minutes",
    )
    .in("id", marketIds);

  const marketsById = new Map<string, MarketRow>(
    (markets ?? []).map((m) => [m.id as string, m as MarketRow]),
  );

  // Cache Binance spot prices per symbol to avoid redundant fetches
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

    // Market over / past trading cutoff → expire the order and refund
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

    // Compute current market price
    let currentYes: number | null = null;
    let currentSpot: number | null = null;

    if (market.duration_minutes != null) {
      // Short-duration: live Black-Scholes from Binance
      currentSpot = await getSpot(market.asset_symbol);
      if (currentSpot == null || market.spot_price_at_open == null) continue;
      const secondsRemaining = Math.max(0, Math.floor((closeAtMs - now) / 1_000));
      const fairYes = computeBinaryYesPrice({
        currentSpotPrice: currentSpot,
        openingSpotPrice: Number(market.spot_price_at_open),
        secondsRemaining,
        recentCandles: [],
      });
      currentYes = applyOverround(fairYes);
    } else {
      // Regular market: fetch latest price from market_prices
      const { data: priceRow } = await supabase
        .from("market_prices")
        .select("yes_price")
        .eq("market_id", market.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!priceRow) continue;
      currentYes = Number(priceRow.yes_price);
    }

    if (currentYes == null) continue;

    const currentSidePrice =
      o.side === "yes"
        ? currentYes
        : applyOverround(1 - currentYes / (1 + OVERROUND));

    const target = Number(o.target_price);

    // Fill when price has dropped to or below the target
    if (currentSidePrice > target) continue;

    // Build RPC args
    let rpcArgs: Record<string, unknown> = {
      p_order_id: o.id,
      p_actual_price: currentSidePrice,
    };

    if (
      market.duration_minutes != null &&
      currentSpot != null &&
      market.spot_price_at_open != null
    ) {
      const secondsRemaining = Math.max(0, Math.floor((closeAtMs - now) / 1_000));
      const direction = getPredictionDirectionFromTradeSide(o.side);
      const reward = getRewardPreview({
        closesAt: market.close_at,
        cutoffAt:
          market.cutoff_at ??
          getShortDurationCutoffAt(market.close_at).toISOString(),
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
      console.log(
        `[limit-order-matcher] Filled order ${o.id} at ${currentSidePrice} (target ${target})`,
      );
    }
  }

  return { checked: orders.length, filled, expired, errors };
}
