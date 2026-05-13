/**
 * One-time script: generates an HD wallet mnemonic + xpub for unique per-user
 * deposit addresses.
 *
 * Run ONCE, then add the output to your .env.local / Vercel env vars.
 * Keep DEPOSIT_WALLET_MNEMONIC secret — it can derive all user private keys.
 * DEPOSIT_WALLET_XPUB is safe to store server-side (cannot derive private keys).
 *
 * Usage:
 *   npx tsx scripts/generate-deposit-wallet.ts
 */

import { HDNodeWallet, Mnemonic } from "ethers";

const mnemonic = Mnemonic.fromEntropy(
  // 16 bytes = 128 bits of entropy = 12-word mnemonic
  crypto.getRandomValues(new Uint8Array(16)),
);

const phrase = mnemonic.phrase;
const root = HDNodeWallet.fromMnemonic(mnemonic);

// Derive to the external chain node (m/0).
// User addresses are then derived at m/0/<index>.
const chainNode = root.deriveChild(0);
const xpub = chainNode.neuter().extendedKey;

// Sanity-check: derive the first 3 addresses
console.log("\n=== HD Wallet Generated ===\n");
for (let i = 0; i < 3; i++) {
  const addr = chainNode.deriveChild(i).address;
  console.log(`Address[${i}]: ${addr}`);
}

console.log(`
=== Add these to .env.local and Vercel env vars ===

DEPOSIT_WALLET_MNEMONIC="${phrase}"
DEPOSIT_WALLET_XPUB="${xpub}"

⚠  DEPOSIT_WALLET_MNEMONIC is a master secret — treat it like a private key.
   Store it in your secrets manager, never commit it to git.
   DEPOSIT_WALLET_XPUB is safe to store server-side.
`);
