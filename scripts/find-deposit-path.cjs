/**
 * Diagnostic: finds which mnemonic derivation path matches the deposit
 * addresses stored in the DB.  Does NOT require DEPOSIT_WALLET_XPUB.
 *
 * Run: node scripts/find-deposit-path.cjs
 */
require("dotenv").config({ path: ".env.local" });
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

const MNEMONIC = process.env.DEPOSIT_WALLET_MNEMONIC;
if (!MNEMONIC) { console.error("DEPOSIT_WALLET_MNEMONIC not set"); process.exit(1); }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Get deposit addresses + indices from DB
  const { data: wallets } = await supabase
    .from("wallets")
    .select("deposit_address, deposit_address_index")
    .not("deposit_address", "is", null)
    .not("deposit_address_index", "is", null)
    .order("deposit_address_index")
    .limit(5);

  if (!wallets?.length) { console.log("No deposit addresses in DB"); return; }

  console.log("\nDB addresses:");
  for (const w of wallets) {
    console.log(`  index ${w.deposit_address_index}: ${w.deposit_address}`);
  }

  // Derive all candidate parent nodes
  const seed     = ethers.Mnemonic.fromPhrase(MNEMONIC).computeSeed();
  const seedRoot = ethers.HDNodeWallet.fromSeed(seed);

  // fromMnemonic without path defaults to m/44'/60'/0'/0 in ethers v6
  const bip44Node    = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(MNEMONIC));
  const bip44depth   = bip44Node.depth;

  console.log(`\nfromMnemonic() node depth: ${bip44depth}  path: ${bip44Node.path}`);
  console.log(`fromMnemonic() address: ${bip44Node.address}`);
  console.log(`fromSeed root address:  ${seedRoot.address}`);

  // Also derive the XPUB from the mnemonic the same way generate-deposit-wallet.ts does
  // root = fromMnemonic, then chainNode = root.deriveChild(0)
  const chainNodeFromBip44 = bip44Node.deriveChild(0);
  console.log(`\nxpub candidate (bip44.deriveChild(0)) address: ${chainNodeFromBip44.address}`);
  console.log(`xpub candidate depth: ${chainNodeFromBip44.depth}  path: ${chainNodeFromBip44.path}`);
  const derivedXpub = chainNodeFromBip44.neuter().extendedKey;
  console.log(`Derived XPUB: ${derivedXpub}`);

  // Candidate derivation functions — all index-based
  const candidates = [
    { label: "fromMnemonic.deriveChild(0).deriveChild(i)  [generate script pattern]",
      fn: (i) => bip44Node.deriveChild(0).deriveChild(i) },
    { label: "fromMnemonic.deriveChild(i)",
      fn: (i) => bip44Node.deriveChild(i) },

    { label: "seed→m/44'/60'/0'/0/0/<i>",
      fn: (i) => seedRoot.derivePath(`m/44'/60'/0'/0/0/${i}`) },
    { label: "seed→m/44'/60'/0'/0/<i>",
      fn: (i) => seedRoot.derivePath(`m/44'/60'/0'/0/${i}`) },
    { label: "seed→m/0/<i>",
      fn: (i) => seedRoot.derivePath(`m/0/${i}`) },
    { label: "seed→m/0/0/<i>",
      fn: (i) => seedRoot.derivePath(`m/0/0/${i}`) },

    { label: "seed→m/44'/60'/0'/0/0/0/<i>",
      fn: (i) => seedRoot.derivePath(`m/44'/60'/0'/0/0/0/${i}`) },
  ];

  // Test against each DB wallet
  const testWallet = wallets[0];
  const testIndex  = testWallet.deposit_address_index;
  const testAddr   = testWallet.deposit_address.toLowerCase();

  console.log(`\n=== Searching for path that derives ${testWallet.deposit_address} (index ${testIndex}) ===\n`);
  for (const c of candidates) {
    try {
      const addr  = c.fn(testIndex).address.toLowerCase();
      const match = addr === testAddr;
      console.log(`${match ? "✓ MATCH" : "      "} | ${c.label}`);
      if (!match) console.log(`       |   got: ${addr}`);
    } catch (e) {
      console.log(`  ERROR | ${c.label} — ${e.message.split("(")[0].trim()}`);
    }
  }

  // If a second wallet exists, verify the match holds
  if (wallets.length > 1) {
    const w2 = wallets[1];
    console.log(`\nDouble-checking with index ${w2.deposit_address_index} (${w2.deposit_address}):`);
    for (const c of candidates) {
      try {
        const addr  = c.fn(w2.deposit_address_index).address.toLowerCase();
        const match = addr === w2.deposit_address.toLowerCase();
        if (match) console.log(`  ✓ ALSO matches: ${c.label}`);
      } catch {}
    }
  }
}

main().catch(console.error);
