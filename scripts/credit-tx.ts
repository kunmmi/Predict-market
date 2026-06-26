import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TX_HASH = "0x9cdad5fd1f4c225c2799300fd9d955f27e4b0500f34e578959261975330d5fa9";
const DEPOSIT_ADDRESS = "0xAC0F212F8e11A3F5c5bc2cad06F215Ef384a87e8";
const AMOUNT = 1.0;

async function main() {
  // Check if already credited
  const { data: existing } = await sb
    .from("deposits")
    .select("id, status, amount_received")
    .eq("tx_hash", TX_HASH)
    .maybeSingle();

  if (existing) {
    console.log("Already in DB:", existing);
    return;
  }

  // Get wallet owner
  const { data: wallet } = await sb
    .from("wallets")
    .select("id, profile_id, balance, available_balance")
    .eq("deposit_address", DEPOSIT_ADDRESS)
    .single();

  if (!wallet) { console.error("Wallet not found for address"); process.exit(1); }
  console.log("Wallet owner:", wallet.profile_id, "| balance before:", wallet.balance);

  // Insert deposit record
  const { data: deposit, error: depErr } = await sb
    .from("deposits")
    .insert({
      profile_id: wallet.profile_id,
      deposit_address: DEPOSIT_ADDRESS,
      asset_symbol: "USDT",
      network_name: "BSC",
      amount_received: AMOUNT,
      tx_hash: TX_HASH,
      status: "approved",
    })
    .select("id")
    .single();

  if (depErr) { console.error("Deposit insert failed:", depErr.message); process.exit(1); }
  console.log("Deposit record created:", deposit.id);

  // Credit wallet
  const balBefore = parseFloat(String(wallet.balance));
  const { error: wErr } = await sb
    .from("wallets")
    .update({
      balance: balBefore + AMOUNT,
      available_balance: parseFloat(String(wallet.available_balance)) + AMOUNT,
    })
    .eq("id", wallet.id);

  if (wErr) { console.error("Wallet update failed:", wErr.message); process.exit(1); }

  // Insert wallet transaction
  const { error: txErr } = await sb
    .from("wallet_transactions")
    .insert({
      wallet_id: wallet.id,
      profile_id: wallet.profile_id,
      transaction_type: "deposit_credit",
      amount: AMOUNT,
      direction: "credit",
      asset_symbol: "USDT",
      reference_table: "deposits",
      reference_id: deposit.id,
      balance_before: balBefore,
      balance_after: balBefore + AMOUNT,
      description: `USDT deposit credited — tx ${TX_HASH.slice(0, 20)}…`,
    });

  if (txErr) { console.error("Wallet tx insert failed:", txErr.message); process.exit(1); }

  // Verify
  const { data: after } = await sb
    .from("wallets")
    .select("balance, available_balance")
    .eq("id", wallet.id)
    .single();

  console.log(`\nCredited $${AMOUNT} USDT to profile ${wallet.profile_id.slice(0, 8)}`);
  console.log("Wallet after:", after);
}

main().catch(e => { console.error(e); process.exit(1); });
