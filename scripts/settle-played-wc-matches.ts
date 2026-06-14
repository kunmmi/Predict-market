/**
 * Settles all 2026 World Cup group-stage match markets whose kickoff has
 * already passed (cutoff_at < now) and which are still unsettled.
 *
 * Winner is chosen per market as the outcome with the highest pool_amount
 * (i.e. the community favourite). Equal pools → "Draw" wins.
 *
 * Usage:
 *   npx tsx scripts/settle-played-wc-matches.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Optional: SYSTEM_ADMIN_PROFILE_ID (used as p_admin_profile_id)
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const adminProfileId = process.env.SYSTEM_ADMIN_PROFILE_ID ?? "";

async function main() {
  console.log("══════════════════════════════════════════════");
  console.log(" 2026 World Cup — Settle Played Matches");
  console.log("══════════════════════════════════════════════\n");

  // 1. Find all wc26-* markets that are past cutoff and not yet settled
  const now = new Date().toISOString();

  const { data: markets, error: mErr } = await supabase
    .from("markets")
    .select("id, slug, title, status, cutoff_at")
    .like("slug", "wc26-%")
    .not("status", "in", '("settled","cancelled")')
    .lte("cutoff_at", now)
    .order("cutoff_at", { ascending: true });

  if (mErr) {
    console.error("Failed to fetch markets:", mErr.message);
    process.exit(1);
  }

  if (!markets || markets.length === 0) {
    console.log("No unsettled past-cutoff wc26-* markets found.");
    return;
  }

  console.log(`Found ${markets.length} match(es) to settle:\n`);

  let settled = 0;
  let failed  = 0;

  for (const market of markets) {
    // 2. Fetch outcomes for this market
    const { data: outcomes, error: oErr } = await supabase
      .from("market_outcomes")
      .select("id, slug, label, pool_amount")
      .eq("market_id", market.id)
      .order("sort_order", { ascending: true });

    if (oErr || !outcomes || outcomes.length === 0) {
      console.error(`  [FAIL] ${market.slug}: could not fetch outcomes — ${oErr?.message ?? "none found"}`);
      failed++;
      continue;
    }

    // 3. Pick winner: highest pool_amount. Ties → Draw (slug="draw"), then first outcome
    let winner = outcomes[0];
    for (const o of outcomes) {
      const oPool = parseFloat(String(o.pool_amount ?? "0"));
      const wPool = parseFloat(String(winner.pool_amount ?? "0"));
      if (oPool > wPool) {
        winner = o;
      } else if (oPool === wPool && o.slug === "draw") {
        // Prefer draw on exact tie
        winner = o;
      }
    }

    // 4. Call settle_multi_market RPC
    const { error: rpcErr } = await supabase.rpc("settle_multi_market", {
      p_market_id:         market.id,
      p_winner_outcome_id: winner.id,
      p_admin_profile_id:  adminProfileId,
      p_notes:             `Auto-settled: ${winner.label} wins (highest pool — community pick)`,
    });

    if (rpcErr) {
      console.error(`  [FAIL] ${market.slug} (${market.title}): ${rpcErr.message}`);
      failed++;
      continue;
    }

    const kickoffStr = market.cutoff_at
      ? new Date(market.cutoff_at).toISOString().slice(0, 16).replace("T", " ")
      : "?";
    const poolStr = outcomes
      .map((o) => `${o.slug}=${o.pool_amount}`)
      .join(", ");

    console.log(
      `  ✓ ${market.slug.padEnd(10)}  ${market.title.padEnd(35)}  winner: ${winner.label.padEnd(20)}  [${kickoffStr} UTC]`,
    );
    console.log(`              pools: ${poolStr}`);
    settled++;
  }

  console.log(`\n══════════════════════════════════════════════`);
  console.log(` Settled: ${settled}   Failed: ${failed}`);
  console.log(`══════════════════════════════════════════════`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
