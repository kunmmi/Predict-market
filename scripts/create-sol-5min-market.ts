/**
 * Seeds the initial SOL 5-minute short-duration market round.
 * The settlement cron auto-rolls subsequent rounds from this seed.
 *
 * Usage: npx tsx scripts/create-sol-5min-market.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const BINANCE_URL = "https://api.binance.com";

async function getSolSpotPrice(): Promise<number> {
  const res = await fetch(`${BINANCE_URL}/api/v3/ticker/price?symbol=SOLUSDT`);
  if (!res.ok) throw new Error(`Binance error: ${res.status}`);
  const data = await res.json() as { price: string };
  return parseFloat(data.price);
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;
  if (!systemAdminId) throw new Error("SYSTEM_ADMIN_PROFILE_ID not set in .env.local");

  // Check if a sol-5min market already exists and is active
  const { data: existing } = await supabase
    .from("markets")
    .select("id, slug, status, close_at")
    .eq("slug", "sol-5min")
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    console.log(`[SKIP] Active sol-5min market already exists:`);
    console.log(`  ID:       ${existing.id}`);
    console.log(`  Closes:   ${existing.close_at}`);
    return;
  }

  // Fetch live SOL price
  console.log("Fetching SOL spot price from Binance...");
  const spotPrice = await getSolSpotPrice();
  console.log(`  SOL/USDT: $${spotPrice.toFixed(4)}`);

  // Compute next 5-minute boundary (same logic as admin API)
  const DURATION_MS = 5 * 60_000;
  const now = Date.now();
  let nextBoundary = (Math.floor(now / DURATION_MS) + 1) * DURATION_MS;
  // Ensure at least 60s of trading time before close
  if (nextBoundary - now < 60_000) nextBoundary += DURATION_MS;

  const closeAt   = new Date(nextBoundary).toISOString();
  const cutoffAt  = new Date(nextBoundary - 15_000).toISOString();

  console.log(`  Close at: ${closeAt}`);
  console.log(`  Cutoff:   ${cutoffAt}`);

  const { data: market, error } = await supabase
    .from("markets")
    .insert({
      title:           "Will SOL go UP or DOWN in the next 5 minutes?",
      title_zh:        "SOL 在接下来的 5 分钟内，价格会上涨还是下跌？",
      slug:            "sol-5min",
      description:     "Predict whether Solana will be higher or lower at the end of this 5-minute round.",
      description_zh:  "预测 Solana 在本轮 5 分钟结束时，价格是上涨还是下跌。",
      category:        "Crypto",
      asset_symbol:    "SOL",
      question_text:   "Will SOL go UP or DOWN in the next 5 minutes?",
      question_text_zh: "SOL 在接下来的 5 分钟内，价格会上涨还是下跌？",
      rules_text:      "Settled using Binance SOLUSDT price. UP = final price > opening price. DOWN = final price < opening price.",
      rules_text_zh:   "使用 Binance SOLUSDT 价格结算。UP = 最终价格高于开盘价，DOWN = 最终价格低于开盘价。",
      close_at:        closeAt,
      settle_at:       closeAt,
      cutoff_at:       cutoffAt,
      status:          "active",
      created_by:      systemAdminId,
      resolution_outcome: "unresolved",
      duration_minutes: 5,
      target_direction: null,
      spot_price_at_open: spotPrice,
      final_spot_price: null,
      round_result:    null,
    })
    .select("id, slug, close_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      console.log("[SKIP] sol-5min already exists (concurrent insert). No action needed.");
    } else {
      throw new Error(`Insert failed: ${error.message}`);
    }
    return;
  }

  console.log("\n[OK] Created sol-5min market:");
  console.log(`  ID:     ${market.id}`);
  console.log(`  Slug:   ${market.slug}`);
  console.log(`  Opens:  NOW  (SOL at $${spotPrice.toFixed(4)})`);
  console.log(`  Closes: ${market.close_at}`);
  console.log("\nThe settlement cron will auto-roll subsequent rounds.");
}

main().catch((e) => { console.error(e); process.exit(1); });
