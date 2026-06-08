/**
 * Market-maker service.
 *
 * Places a small set of house limit orders around the current price to seed
 * the order book with real depth until organic user volume takes over.
 *
 * Orders are owned by the SYSTEM_ADMIN_PROFILE_ID account and backed by a
 * real wallet balance. When a round ends, expire_limit_orders_for_market
 * cancels them and the funds return to the house wallet automatically.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FEE_RATE = 0.025;

// How far below current price each level sits (in probability units)
const LEVEL_OFFSETS = [0.07, 0.12, 0.17];

// Stake ranges per level [min, max] in USD.
// Closer levels (tighter spread) carry more liquidity — realistic for a real book.
const STAKE_RANGES: [number, number][] = [
  [12, 22], // level 1 — closest to market, most liquid
  [7, 14],  // level 2 — mid spread
  [4, 9],   // level 3 — furthest out, least liquid
];

/** Returns a random integer between min and max (inclusive). */
function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export type SeedOrdersResult = {
  success: boolean;
  placed: number;
  cancelled: number;
  error?: string;
};

function getSystemProfileId(): string {
  const id = process.env.SYSTEM_ADMIN_PROFILE_ID;
  if (!id) throw new Error("SYSTEM_ADMIN_PROFILE_ID is not set.");
  return id;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Cancel all open house orders on a market, then place fresh spread orders.
 * Safe to call multiple times — idempotent via cancel-then-place.
 */
async function isMarketMakerEnabled(): Promise<boolean> {
  // Env var override takes precedence (useful for emergencies without a deploy)
  if (process.env.MARKET_MAKER_ENABLED === "false") return false;

  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "market_maker_enabled")
      .maybeSingle();
    return data?.value !== "false";
  } catch {
    return true; // fail open — don't break round creation if settings table is missing
  }
}

export async function seedMarketMakerOrders(
  marketId: string,
  currentYesPrice: number,
): Promise<SeedOrdersResult> {
  if (!(await isMarketMakerEnabled())) {
    return { success: true, placed: 0, cancelled: 0 };
  }

  let profileId: string;
  try {
    profileId = getSystemProfileId();
  } catch (err) {
    return { success: false, placed: 0, cancelled: 0, error: String(err) };
  }

  const supabase = createSupabaseAdminClient();

  // 1. Cancel existing open house orders on this market
  const { data: existing } = await supabase
    .from("limit_orders")
    .select("id, amount_stake, fee_amount")
    .eq("market_id", marketId)
    .eq("profile_id", profileId)
    .eq("status", "open");

  let cancelled = 0;
  for (const order of existing ?? []) {
    const { data: ok } = await supabase.rpc("cancel_limit_order", {
      p_order_id: order.id,
      p_profile_id: profileId,
      p_reason: "maker_refresh",
    });
    if (ok) cancelled++;
  }

  // 2. Build spread levels
  const noPrice = clamp(1 - currentYesPrice, 0.01, 0.99);

  const levels: { side: "yes" | "no"; targetPrice: number; stake: number }[] = [];

  LEVEL_OFFSETS.forEach((offset, i) => {
    const [min, max] = STAKE_RANGES[i] ?? [6, 12];
    const yesTarget = clamp(currentYesPrice - offset, 0.05, 0.94);
    const noTarget  = clamp(noPrice - offset, 0.05, 0.94);
    // Each side gets its own random stake so the two sides look independent
    levels.push({ side: "yes", targetPrice: Math.round(yesTarget * 1000) / 1000, stake: randBetween(min, max) });
    levels.push({ side: "no",  targetPrice: Math.round(noTarget  * 1000) / 1000, stake: randBetween(min, max) });
  });

  // 3. Place the orders
  let placed = 0;
  const errors: string[] = [];

  for (const { side, targetPrice, stake } of levels) {
    const fee = Math.round(stake * FEE_RATE * 1_000_000) / 1_000_000;
    const { error } = await supabase.rpc("place_limit_order", {
      p_profile_id: profileId,
      p_market_id: marketId,
      p_side: side,
      p_amount: stake,
      p_target_price: targetPrice,
      p_fee_amount: fee,
    });

    if (error) {
      errors.push(`${side}@${targetPrice}: ${error.message}`);
    } else {
      placed++;
    }
  }

  return {
    success: errors.length === 0,
    placed,
    cancelled,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}
