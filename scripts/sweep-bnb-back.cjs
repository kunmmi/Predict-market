/**
 * One-time script: sweep leftover BNB from initialized deposit addresses
 * back to the master wallet.
 *
 * Only touches addresses where sweep_approved_at IS set (approve() already
 * ran, so the BNB is no longer needed). Skips uninitialized addresses.
 *
 * Run with:
 *   node scripts/sweep-bnb-back.cjs
 *
 * Requires DEPOSIT_WALLET_MNEMONIC in .env.local
 */

require("dotenv").config({ path: ".env.local" });
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

const MASTER = "0x8727e5523C807C6A8BA27C65ae8F13e67E4e2fB0";
const MNEMONIC = process.env.DEPOSIT_WALLET_MNEMONIC;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MNEMONIC) { console.error("DEPOSIT_WALLET_MNEMONIC not set in .env.local"); process.exit(1); }

const RPCS = [
  "https://bsc-dataseed2.binance.org",
  "https://bsc-dataseed3.binance.org",
  "https://bsc-dataseed4.binance.org",
  "https://bsc.publicnode.com",
  "https://binance.llamarpc.com",
];

async function getProvider() {
  for (const url of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber();
      console.log(`Connected to ${url}`);
      return p;
    } catch {
      console.log(`${url} failed, trying next...`);
    }
  }
  throw new Error("All RPC endpoints failed");
}

let provider;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Leave this much BNB as buffer for gas on the send tx itself
const GAS_RESERVE = ethers.parseEther("0.00005");
// Only bother if balance > this
const MIN_WORTH_SWEEPING = ethers.parseEther("0.00005");

async function main() {
  provider = await getProvider();
  // ethers v6 HDNodeWallet.fromMnemonic defaults to m/44'/60'/0'/0/0 (depth 5).
  // That depth-5 node is the master wallet. Deposit addresses are one level deeper:
  //   deposit[i] = m/44'/60'/0'/0/0/0/<i>
  // Use fromSeed (depth 0) + derivePath so absolute paths work without error.
  const seed = ethers.Mnemonic.fromPhrase(MNEMONIC).computeSeed();
  const root = ethers.HDNodeWallet.fromSeed(seed);

  const { data: wallets } = await supabase
    .from("wallets")
    .select("deposit_address, deposit_address_index, sweep_approved_at, profiles(email)")
    .not("deposit_address", "is", null)
    .not("sweep_approved_at", "is", null); // only initialized

  if (!wallets?.length) {
    console.log("No initialized deposit addresses found.");
    return;
  }

  console.log(`Found ${wallets.length} initialized address(es). Checking BNB balances...\n`);

  for (const w of wallets) {
    const addr  = w.deposit_address;
    const index = w.deposit_address_index;
    const profile = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles;

    if (index === null || index === undefined) {
      console.log(`${addr} — skipping (no index)`);
      continue;
    }

    const balance = await provider.getBalance(addr);
    const balEth  = ethers.formatEther(balance);

    if (balance <= MIN_WORTH_SWEEPING) {
      console.log(`${addr} (${profile?.email}) — $${(parseFloat(balEth) * 620).toFixed(4)} — too small, skipping`);
      continue;
    }

    const sendAmount = balance - GAS_RESERVE;
    const sendEth    = ethers.formatEther(sendAmount);

    console.log(`${addr} (${profile?.email})`);
    console.log(`  Balance: ${balEth} BNB ($${(parseFloat(balEth) * 620).toFixed(4)})`);
    console.log(`  Sending: ${sendEth} BNB back to master...`);

    const depWallet = root.derivePath(`m/44'/60'/0'/0/0/0/${index}`).connect(provider);
    const tx = await depWallet.sendTransaction({
      to: MASTER,
      value: sendAmount,
    });

    console.log(`  TX: ${tx.hash}`);
    await tx.wait();
    console.log(`  ✓ Done\n`);
  }

  const masterBal = await provider.getBalance(MASTER);
  console.log(`Master wallet BNB now: ${ethers.formatEther(masterBal)} BNB ($${(parseFloat(ethers.formatEther(masterBal)) * 620).toFixed(4)})`);
}

main().catch(console.error);
