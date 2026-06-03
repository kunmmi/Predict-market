/**
 * sweep-deposits.mjs
 *
 * Collects USDT sitting in user deposit addresses and transfers it to
 * the platform's main wallet.
 *
 * How it works:
 *   1. Reads all deposit addresses + derivation indexes from the DB
 *   2. Checks each address's USDT balance on BSC
 *   3. For addresses that have USDT but no BNB for gas → sends a dust
 *      amount of BNB from the main wallet first
 *   4. Signs a USDT transfer from each child address → main wallet
 *
 * Required env vars (add to .env.local or pass inline):
 *   DEPOSIT_WALLET_MNEMONIC      — 12-word phrase (NEVER commit this)
 *   DEPOSIT_ADDRESS_BSC          — your main platform wallet address (destination)
 *   WALLET_PRIVATE_KEY_ETH       — private key of the main platform wallet (for gas top-ups)
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — Supabase service role key
 *
 * Usage:
 *   node scripts/sweep-deposits.mjs              (dry run — shows balances only)
 *   node scripts/sweep-deposits.mjs --execute    (actually sends transactions)
 */

import { ethers } from "ethers";
import { HDNodeWallet, Mnemonic } from "ethers";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// ── Config ────────────────────────────────────────────────────────────────────

const EXECUTE = process.argv.includes("--execute");
const BSC_RPC = "https://bsc-dataseed1.binance.org/";
const USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const USDT_DECIMALS = 18;

// Minimum USDT worth sweeping (ignore dust)
const MIN_USDT_TO_SWEEP = 0.10;

// BNB to send for gas when an address has none (~3–5 transfers worth)
const GAS_TOP_UP_BNB = "0.001";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// ── Env validation ────────────────────────────────────────────────────────────

function requireEnv(key) {
  const val = process.env[key];
  if (!val) { console.error(`❌  Missing env var: ${key}`); process.exit(1); }
  return val;
}

const MNEMONIC         = requireEnv("DEPOSIT_WALLET_MNEMONIC");
const MAIN_ADDRESS     = requireEnv("DEPOSIT_ADDRESS_BSC");
const MAIN_PRIVATE_KEY = EXECUTE ? requireEnv("WALLET_PRIVATE_KEY_ETH") : (process.env.WALLET_PRIVATE_KEY_ETH ?? null);
const SUPABASE_URL     = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY      = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

// ── Setup ─────────────────────────────────────────────────────────────────────

const provider   = new ethers.JsonRpcProvider(BSC_RPC);
const mainWallet = MAIN_PRIVATE_KEY ? new ethers.Wallet(MAIN_PRIVATE_KEY, provider) : null;
const usdt       = new ethers.Contract(USDT_CONTRACT, ERC20_ABI, provider);
const supabase   = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Derive the chain node (same path used in deposit-address.ts)
const root      = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(MNEMONIC));
const chainNode = root.deriveChild(0);

function childWallet(index) {
  return new ethers.Wallet(chainNode.deriveChild(index).privateKey, provider);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getUsdtBalance(address) {
  const raw = await usdt.balanceOf(address);
  return parseFloat(ethers.formatUnits(raw, USDT_DECIMALS));
}

async function getBnbBalance(address) {
  const raw = await provider.getBalance(address);
  return parseFloat(ethers.formatEther(raw));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🔍  Sweep mode: ${EXECUTE ? "EXECUTE (real transactions)" : "DRY RUN (read-only)"}`);
  console.log(`📬  Destination: ${MAIN_ADDRESS}\n`);

  // 1. Load all deposit addresses from DB
  const { data: wallets, error } = await supabase
    .from("wallets")
    .select("deposit_address, deposit_address_index, profile_id")
    .not("deposit_address", "is", null)
    .order("deposit_address_index", { ascending: true });

  if (error) { console.error("❌  DB error:", error.message); process.exit(1); }
  console.log(`📋  Found ${wallets.length} deposit address(es) in DB\n`);

  let totalFound = 0;
  let totalSwept = 0;
  let swept = 0;
  let skipped = 0;

  for (const row of wallets) {
    const { deposit_address: address, deposit_address_index: index } = row;

    const usdtBal = await getUsdtBalance(address);
    const bnbBal  = await getBnbBalance(address);

    if (usdtBal < MIN_USDT_TO_SWEEP) {
      process.stdout.write(`  [${index}] ${address}  USDT: ${usdtBal.toFixed(4)} — skipping (below minimum)\n`);
      skipped++;
      continue;
    }

    totalFound += usdtBal;
    console.log(`\n  [${index}] ${address}`);
    console.log(`       USDT: ${usdtBal.toFixed(6)}   BNB: ${bnbBal.toFixed(6)}`);

    if (!EXECUTE) {
      console.log(`       → Would sweep ${usdtBal.toFixed(6)} USDT`);
      swept++;
      continue;
    }

    // ── Gas top-up if needed ──────────────────────────────────────────────────
    const estimatedGasNeeded = 0.0003; // ~60k gas × 5 gwei
    if (bnbBal < estimatedGasNeeded) {
      console.log(`       ⛽  BNB too low — topping up with ${GAS_TOP_UP_BNB} BNB...`);
      try {
        const tx = await mainWallet.sendTransaction({
          to: address,
          value: ethers.parseEther(GAS_TOP_UP_BNB),
        });
        await tx.wait(1);
        console.log(`       ✅  Gas top-up confirmed: ${tx.hash}`);
        // Brief pause so the node picks up the new balance
        await new Promise(r => setTimeout(r, 3000));
      } catch (err) {
        console.error(`       ❌  Gas top-up failed: ${err.message} — skipping address`);
        skipped++;
        continue;
      }
    }

    // ── Sweep USDT ────────────────────────────────────────────────────────────
    try {
      const wallet  = childWallet(index);
      const usdtWithSigner = usdt.connect(wallet);
      const rawAmount = ethers.parseUnits(usdtBal.toFixed(USDT_DECIMALS), USDT_DECIMALS);

      console.log(`       🔄  Sweeping ${usdtBal.toFixed(6)} USDT → main wallet...`);
      const tx = await usdtWithSigner.transfer(MAIN_ADDRESS, rawAmount);
      const receipt = await tx.wait(1);

      if (receipt.status !== 1) throw new Error("Transaction reverted on-chain");

      console.log(`       ✅  Swept! tx: ${tx.hash}`);
      totalSwept += usdtBal;
      swept++;
    } catch (err) {
      console.error(`       ❌  Sweep failed: ${err.message}`);
      skipped++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  if (EXECUTE) {
    console.log(`✅  Swept ${swept} address(es) — total: $${totalSwept.toFixed(4)} USDT`);
  } else {
    console.log(`📊  Dry run complete`);
    console.log(`    Addresses with balance: ${swept}`);
    console.log(`    Total sweepable USDT:   $${totalFound.toFixed(4)}`);
    console.log(`    Skipped (dust/empty):   ${skipped}`);
    console.log(`\n    Run with --execute to perform the sweep.`);
  }
  console.log("─".repeat(60) + "\n");
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
