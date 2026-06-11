/**
 * Clean up duplicate SOL test markets.
 * For each duration (5, 15, 30, 60 min), keep the most-recently-created SOL market
 * and delete all older duplicates (only if they have NO open positions).
 *
 * Usage:  npx tsx scripts/cleanup-sol-markets.ts
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

async function main() {
  // Fetch ALL SOL short-duration markets
  const { data: solMarkets, error } = await supabase
    .from("markets")
    .select("id, title, slug, duration_minutes, status, created_at")
    .eq("asset_symbol", "SOL")
    .not("duration_minutes", "is", null)
    .order("created_at", { ascending: false });

  if (error || !solMarkets) {
    console.error("Failed to fetch:", error?.message);
    process.exit(1);
  }

  console.log(`Found ${solMarkets.length} SOL short-duration markets total.\n`);

  // Group by duration
  const byDuration = new Map<number, typeof solMarkets>();
  for (const m of solMarkets) {
    const d = m.duration_minutes as number;
    if (!byDuration.has(d)) byDuration.set(d, []);
    byDuration.get(d)!.push(m);
  }

  const toDelete: string[] = [];
  const toKeep: typeof solMarkets = [];

  for (const [dur, markets] of byDuration.entries()) {
    const [keep, ...rest] = markets; // most recent first
    toKeep.push(keep);
    console.log(`  [KEEP]  ${dur}min → "${keep.title}" (${keep.status}) created ${keep.created_at?.slice(0, 10)}`);

    for (const m of rest) {
      // Check for open positions before deleting
      const { count } = await supabase
        .from("positions")
        .select("id", { count: "exact", head: true })
        .eq("market_id", m.id)
        .eq("status", "open");

      if ((count ?? 0) > 0) {
        console.log(`  [SKIP]  ${dur}min → "${m.title}" has ${count} open positions — skipping`);
      } else {
        toDelete.push(m.id);
        console.log(`  [DEL]   ${dur}min → "${m.title}" (${m.status}) created ${m.created_at?.slice(0, 10)}`);
      }
    }
    console.log();
  }

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
  } else {
    console.log(`Deleting ${toDelete.length} duplicate markets...`);

    // Delete positions first (settled ones with no open), then the markets
    for (const id of toDelete) {
      await supabase.from("positions").delete().eq("market_id", id);
      const { error: delErr } = await supabase.from("markets").delete().eq("id", id);
      if (delErr) console.error(`  FAILED ${id}: ${delErr.message}`);
    }
    console.log("Done.\n");
  }

  console.log("=== SOL markets remaining ===");
  for (const m of toKeep) {
    console.log(`  ${m.duration_minutes}min — "${m.title}" [${m.status}]`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
