/**
 * Cancel all old binary FIFA markets that have been superseded by the
 * new 3-way per-match multi-outcome markets.
 *
 * Safe to run multiple times — already-cancelled markets are skipped.
 * Positions on cancelled markets are fully refunded via settle_market RPC.
 *
 * Usage: npx tsx scripts/cancel-old-binary-fifa-markets.ts
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
  // Find all active/closed binary FIFA markets
  const { data: markets, error } = await supabase
    .from("markets")
    .select("id, slug, title, status")
    .eq("asset_symbol", "FIFA")
    .eq("market_type", "binary")
    .not("status", "in", "(settled,cancelled)");

  if (error) throw error;

  if (!markets || markets.length === 0) {
    console.log("No active binary FIFA markets found — nothing to cancel.");
    return;
  }

  console.log(`Found ${markets.length} binary FIFA markets to cancel:\n`);

  let cancelled = 0;
  let failed    = 0;

  for (const m of markets) {
    // Check for open positions first (for logging only)
    const { count } = await supabase
      .from("positions")
      .select("id", { count: "exact", head: true })
      .eq("market_id", m.id)
      .eq("status", "open");

    const posCount = count ?? 0;

    // Call settle_market with 'cancelled' — this refunds all open positions
    const { error: rpcErr } = await supabase.rpc("settle_market", {
      p_market_id:  m.id,
      p_resolution: "cancelled",
      p_notes:      "Superseded by 3-way match result market",
    });

    if (rpcErr) {
      console.error(`[FAIL] "${m.slug}" — ${rpcErr.message}`);
      failed++;
    } else {
      console.log(`[OK]  "${m.slug}" cancelled${posCount > 0 ? ` (${posCount} position${posCount === 1 ? "" : "s"} refunded)` : " (no positions)"}`);
      cancelled++;
    }
  }

  console.log(`\nDone. Cancelled: ${cancelled}, Failed: ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
