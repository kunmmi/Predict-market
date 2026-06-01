/**
 * reset-db.mjs
 * Wipes all user-activity data while preserving:
 *   - All rows in `markets`
 *   - All profiles with role = 'admin'
 *   - Wallets belonging to admin profiles
 *
 * Run from the project root:
 *   node scripts/reset-db.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  console.log("🔍  Fetching admin profile IDs…");

  const { data: adminProfiles, error: adminErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (adminErr) {
    console.error("❌  Could not fetch admin profiles:", adminErr.message);
    process.exit(1);
  }

  const adminIds = adminProfiles.map((p) => p.id);
  console.log(`   Found ${adminIds.length} admin account(s): ${adminIds.join(", ")}`);

  // Fetch admin wallet IDs so we can preserve their wallet_transactions
  const { data: adminWallets } = await supabase
    .from("wallets")
    .select("id")
    .in("profile_id", adminIds);

  const adminWalletIds = (adminWallets ?? []).map((w) => w.id);
  console.log(`   Found ${adminWalletIds.length} admin wallet(s)`);

  // ── Helper ────────────────────────────────────────────────────────────────
  async function wipe(table, filter) {
    process.stdout.write(`   Wiping ${table}… `);
    let q = supabase.from(table).delete();
    if (filter) {
      q = filter(q);
    } else {
      // Delete all — Supabase requires a filter even for "delete all"; use neq on a column that is always set
      q = q.neq("id", "00000000-0000-0000-0000-000000000000");
    }
    const { error, count } = await q;
    if (error) {
      console.error(`\n❌  Error wiping ${table}: ${error.message}`);
    } else {
      console.log(`done`);
    }
  }

  console.log("\n🗑️   Deleting in FK-safe order…\n");

  // 1. Leaf tables with no FK dependants ─────────────────────────────────────
  await wipe("commissions");
  await wipe("admin_logs");
  await wipe("tatum_webhook_logs");

  // 2. Platform-level tables ──────────────────────────────────────────────────
  await wipe("platform_withdrawals");
  await wipe("platform_wallet_transactions");

  // 3. User deposits (only non-admin) ─────────────────────────────────────────
  if (adminIds.length > 0) {
    await wipe("deposits", (q) => q.not("profile_id", "in", `(${adminIds.map((id) => `"${id}"`).join(",")})`));
  } else {
    await wipe("deposits");
  }

  // 4. Trades / positions / predictions (non-admin) ───────────────────────────
  if (adminIds.length > 0) {
    await wipe("positions",   (q) => q.not("profile_id", "in", `(${adminIds.map((id) => `"${id}"`).join(",")})`));
    await wipe("predictions", (q) => q.not("profile_id", "in", `(${adminIds.map((id) => `"${id}"`).join(",")})`));
    await wipe("trades",      (q) => q.not("profile_id", "in", `(${adminIds.map((id) => `"${id}"`).join(",")})`));
  } else {
    await wipe("positions");
    await wipe("predictions");
    await wipe("trades");
  }

  // 5. Market prices ──────────────────────────────────────────────────────────
  await wipe("market_prices");

  // 6. Wallet transactions (non-admin wallets only) ───────────────────────────
  if (adminWalletIds.length > 0) {
    await wipe("wallet_transactions", (q) =>
      q.not("wallet_id", "in", `(${adminWalletIds.map((id) => `"${id}"`).join(",")})`)
    );
  } else {
    await wipe("wallet_transactions");
  }

  // 7. Referrals ──────────────────────────────────────────────────────────────
  await wipe("referrals");

  // 8. Promoters (non-admin) ──────────────────────────────────────────────────
  if (adminIds.length > 0) {
    await wipe("promoters", (q) => q.not("profile_id", "in", `(${adminIds.map((id) => `"${id}"`).join(",")})`));
  } else {
    await wipe("promoters");
  }

  // 9. Wallets (non-admin) ────────────────────────────────────────────────────
  if (adminIds.length > 0) {
    await wipe("wallets", (q) => q.not("profile_id", "in", `(${adminIds.map((id) => `"${id}"`).join(",")})`));
  } else {
    await wipe("wallets");
  }

  // 10. Re-assign markets.created_by to first admin so FK won't block profile deletion
  const primaryAdmin = adminIds[0];
  process.stdout.write(`   Re-assigning markets.created_by → ${primaryAdmin}… `);
  {
    const { error } = await supabase
      .from("markets")
      .update({ created_by: primaryAdmin })
      .not("created_by", "in", `(${adminIds.map((id) => `"${id}"`).join(",")})`);
    if (error) console.error(`\n❌  ${error.message}`);
    else console.log("done");
  }

  // 11. Profiles (non-admin) ──────────────────────────────────────────────────
  await wipe("profiles", (q) => q.neq("role", "admin"));

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n✅  Database reset complete.");
  console.log("   Preserved: all markets, all admin profiles + their wallets.");
  console.log("\n⚠️   Note: auth.users entries for deleted profiles still exist in");
  console.log("   Supabase Auth. Clean them up via the Supabase Dashboard →");
  console.log("   Authentication → Users if you want a fully blank auth slate.\n");
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
