import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ADDRESS = "0xAC0F212F8e11A3F5c5bc2cad06F215Ef384a87e8";
const MORALIS_API_KEY = process.env.MORALIS_API_KEY!;

async function main() {
  // Raw Moralis response — all ERC20 transfers, no filter
  console.log("=== Raw Moralis response ===");
  const url = `https://deep-index.moralis.io/api/v2.2/${ADDRESS}/erc20/transfers?chain=bsc&limit=10`;
  const res = await fetch(url, { headers: { "X-API-Key": MORALIS_API_KEY } });
  console.log("HTTP status:", res.status);
  const raw = await res.json();
  console.log(JSON.stringify(raw, null, 2));

  // Also check the user's wallet balance
  console.log("\n=== Wallet ===");
  const { data: wallet } = await sb
    .from("wallets")
    .select("balance, available_balance")
    .eq("deposit_address", ADDRESS)
    .maybeSingle();
  console.log(wallet);

  // Trigger the on-demand check endpoint directly
  console.log("\n=== Triggering on-demand deposit scan ===");
  const { data: owner } = await sb
    .from("wallets")
    .select("profile_id")
    .eq("deposit_address", ADDRESS)
    .maybeSingle();

  if (owner) {
    // Call the sweep cron with just this user's address
    const sweepUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/sweep-deposits`;
    console.log("Profile id:", owner.profile_id);
    console.log("Note: run the sweep or visit the deposit page to trigger the 15s poll");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
