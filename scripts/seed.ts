/**
 * Seed script — creates sample markets and a sample promoter for dev/testing.
 * Idempotent: skips records that already exist (matched by slug / promo_code).
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

// Load .env.local
config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

const MARKETS = [
  {
    title: "Will Bitcoin exceed $100,000 by end of 2025?",
    slug: "btc-above-100k-2025",
    question_text: "Will the price of Bitcoin (BTC) close above $100,000 USD on any day before December 31, 2025?",
    description:
      "This market resolves YES if Bitcoin's closing price exceeds $100,000 USD on any major exchange before the end of 2025.",
    rules_text:
      "Resolution is based on Coinbase or Binance daily closing price. Source: CoinGecko daily close.",
    asset_symbol: "BTC",
    category: "crypto",
    close_at: "2025-12-31T23:59:00Z",
    settle_at: "2026-01-03T00:00:00Z",
    status: "active",
  },
  {
    title: "Will Ethereum reach $5,000 in Q3 2025?",
    slug: "eth-5k-q3-2025",
    question_text: "Will Ethereum (ETH) trade above $5,000 USD at any point during Q3 2025 (July–September)?",
    description:
      "This market resolves YES if ETH trades above $5,000 on any major exchange during Q3 2025.",
    rules_text: "Resolution is based on CoinGecko hourly price data for Q3 2025.",
    asset_symbol: "ETH",
    category: "crypto",
    close_at: "2025-09-30T23:59:00Z",
    settle_at: "2025-10-02T00:00:00Z",
    status: "active",
  },
  {
    title: "Will Solana flip BNB by market cap in 2025?",
    slug: "sol-flip-bnb-2025",
    question_text:
      "Will Solana (SOL) surpass BNB in market capitalization at any point before December 31, 2025?",
    description:
      "This market resolves YES if Solana's market cap exceeds BNB's market cap on CoinGecko at any point in 2025.",
    rules_text: "Resolution is based on CoinGecko market cap rankings at daily snapshot.",
    asset_symbol: "SOL",
    category: "crypto",
    close_at: "2025-12-31T23:59:00Z",
    settle_at: "2026-01-03T00:00:00Z",
    status: "active",
  },
];

// ---------------------------------------------------------------------------
// Promoter
// ---------------------------------------------------------------------------

const SAMPLE_PROMOTER_EMAIL = process.env.ADMIN_EMAIL ?? "bukunmiodukoya@gmail.com";
const SAMPLE_PROMO_CODE = "LAUNCH25";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedMarkets() {
  console.log("Seeding markets...");

  for (const market of MARKETS) {
    // Check if slug already exists
    const { data: existing } = await supabase
      .from("markets")
      .select("id")
      .eq("slug", market.slug)
      .single();

    if (existing) {
      console.log(`  [skip] Market already exists: ${market.slug}`);
      continue;
    }

    const { data, error } = await supabase.from("markets").insert(market).select("id").single();

    if (error) {
      console.error(`  [error] Failed to insert market "${market.slug}":`, error.message);
    } else {
      console.log(`  [ok] Created market: ${market.slug} (${data.id})`);

      // Seed initial prices
      const initPrices = { yes_price: 0.5, no_price: 0.5 };
      const { error: priceError } = await supabase.from("market_prices").insert({
        market_id: data.id,
        yes_price: initPrices.yes_price,
        no_price: initPrices.no_price,
      });
      if (priceError) {
        console.warn(`  [warn] Could not seed initial prices for ${market.slug}:`, priceError.message);
      } else {
        // Also update markets row cache
        await supabase
          .from("markets")
          .update({ yes_price: initPrices.yes_price, no_price: initPrices.no_price })
          .eq("id", data.id);
        console.log(`  [ok] Set initial prices 0.5000 / 0.5000 for ${market.slug}`);
      }
    }
  }
}

async function seedPromoter() {
  console.log("Seeding sample promoter...");

  // Find profile by email
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", SAMPLE_PROMOTER_EMAIL)
    .single();

  if (!profile) {
    console.log(
      `  [skip] Profile not found for ${SAMPLE_PROMOTER_EMAIL}. Sign up first, then re-run seed.`,
    );
    return;
  }

  // Check if promo code already exists
  const { data: existing } = await supabase
    .from("promoters")
    .select("id")
    .eq("promo_code", SAMPLE_PROMO_CODE)
    .single();

  if (existing) {
    console.log(`  [skip] Promoter with code ${SAMPLE_PROMO_CODE} already exists.`);
    return;
  }

  const { data, error } = await supabase
    .from("promoters")
    .insert({
      profile_id: profile.id,
      promo_code: SAMPLE_PROMO_CODE,
      commission_rate: 0.1, // 10%
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("  [error] Failed to create promoter:", error.message);
  } else {
    console.log(`  [ok] Created promoter ${SAMPLE_PROMO_CODE} for ${SAMPLE_PROMOTER_EMAIL} (${data.id})`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Elemental Seed Script ===\n");
  await seedMarkets();
  console.log();
  await seedPromoter();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
