/**
 * Volume-based dynamic pricing engine.
 *
 * Uses a Constant Product Market Maker (CPMM) formula to move YES/NO prices
 * based on cumulative trading volume in each direction.
 *
 * Formula:
 *   yes_price = (L + yes_volume) / (2L + yes_volume + no_volume)
 *
 * Where L = virtual initial liquidity (controls price sensitivity).
 *
 * Properties:
 *   - Zero trades → 50/50
 *   - More YES buyers → YES price rises, NO price falls
 *   - More NO buyers  → NO price rises, YES price falls
 *   - Balanced buying → price stays neutral
 *   - Clamped to [0.03, 0.97] to avoid extreme prices
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Virtual liquidity per side in USD.
 * Higher = more stable prices (harder to move).
 * Lower  = more volatile prices (easier to move).
 *
 * $500 means you need ~$500 of one-sided buying to move the price
 * from 0.50 to roughly 0.67.
 */
const LIQUIDITY = 500;

type PriceResult = {
  yesPrice: number;
  noPrice: number;
  yesUnits: number;
  noUnits: number;
};

/**
 * Calculate new YES/NO prices for a market based on all trade volumes.
 * Does not write to DB — just returns the calculated prices.
 */
export async function calculateMarketPrice(marketId: string): Promise<PriceResult> {
  const supabase = createSupabaseAdminClient();

  const { data: positions } = await supabase
    .from("positions")
    .select("yes_units, no_units")
    .eq("market_id", marketId)
    .eq("status", "open");

  const yesUnits = (positions ?? []).reduce(
    (sum, position) => sum + Number(position.yes_units ?? 0),
    0,
  );
  const noUnits = (positions ?? []).reduce(
    (sum, position) => sum + Number(position.no_units ?? 0),
    0,
  );

  const raw = (LIQUIDITY + yesUnits) / (2 * LIQUIDITY + yesUnits + noUnits);
  const yesPrice = parseFloat(Math.max(0.03, Math.min(0.97, raw)).toFixed(4));
  const noPrice = parseFloat((1 - yesPrice).toFixed(4));

  return { yesPrice, noPrice, yesUnits, noUnits };
}

/**
 * Recalculate prices after a trade and insert a new row into market_prices.
 * Call this after every successful trade — non-blocking from the caller's perspective.
 */
export async function updatePriceAfterTrade(marketId: string): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { yesPrice, noPrice } = await calculateMarketPrice(marketId);

    await supabase.from("market_prices").insert({
      market_id: marketId,
      yes_price: yesPrice,
      no_price: noPrice,
      source: "volume",
    });
  } catch (err) {
    // Non-fatal — price update failure must never break the trade response
    console.error("[dynamic-pricing] Failed to update price after trade:", err);
  }
}
