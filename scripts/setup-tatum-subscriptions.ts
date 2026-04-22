/**
 * Registers Tatum ADDRESS_TRANSACTION webhook subscriptions for each
 * configured platform deposit address.
 *
 * Idempotent — skips addresses that already have an active subscription.
 * Run once after deploying; safe to re-run if addresses change.
 *
 * Usage:
 *   npm run setup:tatum
 *
 * Required env vars in .env.local:
 *   TATUM_API_KEY
 *   TATUM_WEBHOOK_SECRET
 *   NEXT_PUBLIC_APP_URL         (deployed URL, e.g. https://yourapp.vercel.app)
 *
 * Optional (add as many as you have addresses):
 *   DEPOSIT_ADDRESS_BTC
 *   DEPOSIT_ADDRESS_ETH
 *   DEPOSIT_ADDRESS_BSC
 *   DEPOSIT_ADDRESS_SOL
 */

import { config as dotenvConfig } from "dotenv";
import path from "path";

dotenvConfig({ path: path.resolve(process.cwd(), ".env.local") });

const TATUM_API_KEY = process.env.TATUM_API_KEY;
const TATUM_WEBHOOK_SECRET = process.env.TATUM_WEBHOOK_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

if (!TATUM_API_KEY) {
  console.error("Error: TATUM_API_KEY is not set in .env.local");
  process.exit(1);
}
if (!TATUM_WEBHOOK_SECRET) {
  console.error("Error: TATUM_WEBHOOK_SECRET is not set in .env.local");
  process.exit(1);
}

const WEBHOOK_URL = `${APP_URL}/api/webhooks/tatum`;

type AddressEntry = {
  chain: string;
  address: string;
  label: string;
  // Tatum v4 subscription type:
  //   INCOMING_NATIVE_TX  — native coin deposits (BTC, ETH, BNB, SOL)
  //   INCOMING_FUNGIBLE_TX — ERC-20 / BEP-20 token deposits (USDT, USDC)
  type: "INCOMING_NATIVE_TX" | "INCOMING_FUNGIBLE_TX";
};

// Only BSC USDT (BEP-20) is active for launch.
// To add more chains later, uncomment the relevant lines below.
const ALL_ENTRIES: AddressEntry[] = [
  { chain: "BSC", address: process.env.DEPOSIT_ADDRESS_BSC ?? "", label: "BSC (USDT BEP-20)", type: "INCOMING_FUNGIBLE_TX" },
  // { chain: "BSC", address: process.env.DEPOSIT_ADDRESS_BSC ?? "", label: "BSC (native BNB)", type: "INCOMING_NATIVE_TX" },
  // { chain: "ETH", address: process.env.DEPOSIT_ADDRESS_ETH ?? "", label: "Ethereum (native ETH)", type: "INCOMING_NATIVE_TX" },
  // { chain: "ETH", address: process.env.DEPOSIT_ADDRESS_ETH ?? "", label: "Ethereum (USDT/USDC ERC-20)", type: "INCOMING_FUNGIBLE_TX" },
  // { chain: "BTC", address: process.env.DEPOSIT_ADDRESS_BTC ?? "", label: "Bitcoin (native)", type: "INCOMING_NATIVE_TX" },
  // { chain: "SOL", address: process.env.DEPOSIT_ADDRESS_SOL ?? "", label: "Solana (native SOL)", type: "INCOMING_NATIVE_TX" },
];

const entries = ALL_ENTRIES.filter((e) => e.address.length > 0);

if (entries.length === 0) {
  console.warn("No deposit addresses configured in .env.local — nothing to register.");
  console.warn("Set DEPOSIT_ADDRESS_BTC, DEPOSIT_ADDRESS_ETH, DEPOSIT_ADDRESS_BSC, or DEPOSIT_ADDRESS_SOL.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Tatum API helpers
// ---------------------------------------------------------------------------

type TatumSubscription = {
  id: string;
  type?: string;
  attr?: { address?: string; chain?: string; url?: string };
};

async function getExistingSubscriptions(): Promise<TatumSubscription[]> {
  const res = await fetch("https://api.tatum.io/v4/subscription?pageSize=50&offset=0", {
    headers: { "x-api-key": TATUM_API_KEY! },
  });
  if (!res.ok) {
    console.warn("Warning: Could not fetch existing subscriptions:", await res.text());
    return [];
  }
  return (await res.json()) as TatumSubscription[];
}

async function deleteSubscription(id: string): Promise<void> {
  const res = await fetch(`https://api.tatum.io/v4/subscription/${id}`, {
    method: "DELETE",
    headers: { "x-api-key": TATUM_API_KEY! },
  });
  if (!res.ok) {
    console.warn(`  [warn] Could not delete subscription ${id}: ${await res.text()}`);
  }
}

async function registerSubscription(entry: AddressEntry): Promise<void> {
  const body = {
    type: entry.type,
    attr: {
      address: entry.address,
      chain: entry.chain,
      url: WEBHOOK_URL,
    },
  };

  const res = await fetch("https://api.tatum.io/v4/subscription", {
    method: "POST",
    headers: {
      "x-api-key": TATUM_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`  [error] ${entry.label} (${entry.chain}): ${errText}`);
    return;
  }

  const result = (await res.json()) as { id?: string };
  const subId = result.id ?? "unknown";
  console.log(`  [ok] ${entry.label} (${entry.chain}) — subscription ID: ${subId}`);

  // Set HMAC secret for this subscription via separate endpoint
  if (subId !== "unknown" && TATUM_WEBHOOK_SECRET) {
    const hmacRes = await fetch(`https://api.tatum.io/v4/subscription/${subId}/hmac`, {
      method: "PUT",
      headers: {
        "x-api-key": TATUM_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hmacSecret: TATUM_WEBHOOK_SECRET }),
    });
    if (hmacRes.ok) {
      console.log(`       HMAC secret set for ${subId}`);
    } else {
      // HMAC endpoint may not exist in all Tatum plans — non-fatal
      console.log(`       HMAC secret skipped (${hmacRes.status}) — webhook will work without signature verification`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Tatum Subscription Setup ===");
  console.log(`Webhook URL: ${WEBHOOK_URL}\n`);

  const existing = await getExistingSubscriptions();
  // Build a map of existing subscriptions: key → { id, url }
  const existingMap = new Map<string, { id: string; url: string | undefined }>();
  for (const s of existing) {
    if (s.attr?.address && s.attr?.chain) {
      const key = `${s.type ?? ""}:${s.attr.chain.toUpperCase()}:${s.attr.address.toLowerCase()}`;
      existingMap.set(key, { id: s.id, url: s.attr.url });
    }
  }

  for (const entry of entries) {
    const key = `${entry.type}:${entry.chain.toUpperCase()}:${entry.address.toLowerCase()}`;
    const existing = existingMap.get(key);

    if (existing) {
      if (existing.url === WEBHOOK_URL) {
        console.log(`  [skip] ${entry.label} — already registered with correct URL`);
        continue;
      }
      // URL changed (e.g. tunnel restarted) — delete and re-register
      console.log(`  [update] ${entry.label} — webhook URL changed, re-registering...`);
      await deleteSubscription(existing.id);
    }

    await registerSubscription(entry);
  }

  console.log("\nDone. Tatum will now send webhooks to your endpoint when deposits arrive.");
}

void main().catch((err: unknown) => {
  console.error("Setup script failed:", err);
  process.exit(1);
});
