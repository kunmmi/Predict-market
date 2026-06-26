/**
 * GET /api/cron/sweep-deposits
 *
 * Queries BSC directly via public RPC nodes (eth_getLogs) to find incoming
 * USDT transfers to every assigned deposit address, then credits any that
 * weren't already handled.
 *
 * Uses multiple RPC fallbacks and always picks the node with the highest
 * block number to avoid stale-node issues.
 *
 * Call this on a schedule (e.g. every minute via cron-job.org).
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";
const TRANSFER_SIG   = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDT_DECIMALS  = 18;
const BLOCKS_TO_SCAN = 300; // ~15 min of BSC blocks (3 s/block) — buffer for delayed cron runs
const MAX_DEPOSIT_AGE_MS = 24 * 60 * 60 * 1000; // only auto-credit deposits seen in the last 24h

// NOTE: rpc.ankr.com now requires an API key and the plain bsc-dataseed nodes
// reject eth_getLogs over a block range ("archive request"). drpc / llamarpc /
// publicnode allow the getLogs scan this sweep depends on — keep them first.
const BSC_RPCS = [
  "https://bsc.drpc.org",
  "https://binance.llamarpc.com",
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.ninicoin.io",
  "https://bsc-dataseed2.defibit.io",
];

// ---------------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------------

async function jsonRpc(rpc: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store" as RequestCache,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

/** Query all RPCs in parallel, return the one with the highest block number. */
async function getBestRpc(): Promise<{ rpc: string; blockNumber: number }> {
  const results = await Promise.allSettled(
    BSC_RPCS.map(async (rpc) => {
      const hex = (await jsonRpc(rpc, "eth_blockNumber", [])) as string;
      return { rpc, blockNumber: parseInt(hex, 16) };
    })
  );

  let best = { rpc: BSC_RPCS[0], blockNumber: 0 };
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.blockNumber > best.blockNumber) {
      best = r.value;
    }
  }
  if (best.blockNumber === 0) throw new Error("All BSC RPCs failed");
  return best;
}

// ---------------------------------------------------------------------------
// Log entry type
// ---------------------------------------------------------------------------

type EvmLog = {
  transactionHash: string;
  topics: string[];
  data: string;
};

type Transfer = {
  txHash: string;
  toAddress: string; // lowercase
  amount: number;
};

// ---------------------------------------------------------------------------
// Fetch all incoming USDT transfers to any of our deposit addresses
// in the last BLOCKS_TO_SCAN blocks — single RPC call.
// ---------------------------------------------------------------------------

async function fetchIncomingTransfers(addresses: string[]): Promise<Transfer[]> {
  // Primary: Moralis EVM API. Public BSC RPCs reject ranged eth_getLogs from
  // datacenter IPs (Vercel), so the on-chain log scan below fails in production.
  // Moralis is keyed and reliable from any server, so prefer it when available.
  if (process.env.MORALIS_API_KEY) {
    try {
      return await fetchIncomingTransfersMoralis(addresses);
    } catch (err) {
      console.warn(`[sweep] Moralis API fetch failed, falling back to RPC: ${err instanceof Error ? err.message : err}`);
    }
  }
  return fetchIncomingTransfersRpc(addresses);
}

/**
 * Fetch recent incoming USDT transfers per address via the Moralis EVM API.
 * One request per address; filters to USDT (BEP-20) transfers received by us.
 */
async function fetchIncomingTransfersMoralis(addresses: string[]): Promise<Transfer[]> {
  const apiKey = process.env.MORALIS_API_KEY!;
  const out: Transfer[] = [];

  for (const addr of addresses) {
    const url = `https://deep-index.moralis.io/api/v2.2/${addr}/erc20/transfers?chain=bsc&limit=30`;
    const res = await fetch(url, {
      headers: { "X-API-Key": apiKey, accept: "application/json" },
      cache: "no-store" as RequestCache,
    });
    if (!res.ok) {
      console.warn(`[sweep] Moralis API HTTP ${res.status} for ${addr}`);
      continue;
    }
    const json = (await res.json()) as {
      result?: Array<{
        transaction_hash: string;
        address: string;          // token contract
        to_address: string;
        value?: string;
        value_decimal?: string;
        block_timestamp?: string;
      }>;
    };
    for (const t of json.result ?? []) {
      if ((t.address ?? "").toLowerCase() !== USDT_CONTRACT.toLowerCase()) continue;
      if ((t.to_address ?? "").toLowerCase() !== addr.toLowerCase()) continue;

      // SAFETY: only auto-credit recent transfers. The sweep runs every 5 min,
      // so anything legitimate is caught well within this window. Refusing old
      // transfers means the sweep can never re-credit a months-old deposit if a
      // deposit record is ever lost/regenerated (which previously caused a
      // double-credit). Older missed deposits must be recovered manually.
      if (t.block_timestamp) {
        const ageMs = Date.now() - new Date(t.block_timestamp).getTime();
        if (Number.isFinite(ageMs) && ageMs > MAX_DEPOSIT_AGE_MS) continue;
      }

      const amount =
        t.value_decimal != null
          ? parseFloat(t.value_decimal)
          : Number(BigInt(t.value ?? "0")) / Math.pow(10, USDT_DECIMALS);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      out.push({ txHash: t.transaction_hash, toAddress: addr.toLowerCase(), amount });
    }
  }

  console.log(`[sweep] Moralis API → ${out.length} incoming USDT transfers across ${addresses.length} addresses`);
  return out;
}

/** Fallback: scan recent blocks for USDT transfers via public BSC RPC getLogs. */
async function fetchIncomingTransfersRpc(addresses: string[]): Promise<Transfer[]> {
  const { rpc, blockNumber } = await getBestRpc();
  const fromBlock = Math.max(0, blockNumber - BLOCKS_TO_SCAN);

  // Pad each address to 32-byte topic format
  const paddedAddresses = addresses.map(
    (a) => "0x" + a.replace(/^0x/i, "").toLowerCase().padStart(64, "0")
  );

  const filter = {
    address: USDT_CONTRACT,
    topics: [TRANSFER_SIG, null, paddedAddresses],
    fromBlock: "0x" + fromBlock.toString(16),
    toBlock: "latest",
  };

  // Try each RPC until one succeeds for getLogs
  let logs: EvmLog[] | null = null;
  let usedRpc = rpc;
  for (const candidate of [rpc, ...BSC_RPCS.filter(r => r !== rpc)]) {
    try {
      logs = (await jsonRpc(candidate, "eth_getLogs", [filter])) as EvmLog[];
      usedRpc = candidate;
      break;
    } catch {
      // try next
    }
  }
  if (logs === null) throw new Error("All RPCs failed for eth_getLogs");

  console.log(
    `[sweep] RPC ${usedRpc} block=${blockNumber} scanned last ${BLOCKS_TO_SCAN} blocks → ${logs.length} USDT transfers to our addresses`
  );

  return logs.map((log) => ({
    txHash: log.transactionHash,
    toAddress: "0x" + log.topics[2].slice(26).toLowerCase(),
    amount: Number(BigInt(log.data)) / Math.pow(10, USDT_DECIMALS),
  }));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // Fail closed: reject if CRON_SECRET is unset or the bearer token doesn't match.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const adminId = process.env.SYSTEM_ADMIN_PROFILE_ID;
  if (!adminId) return NextResponse.json({ error: "SYSTEM_ADMIN_PROFILE_ID not set" }, { status: 500 });

  // Fetch all wallets — filter in JS to avoid a PostgREST bug where
  // .not("deposit_address","is",null) silently excludes some rows.
  const { data: allWallets, error: walletsErr } = await supabase
    .from("wallets")
    .select("profile_id, deposit_address");

  if (walletsErr) return NextResponse.json({ credited: 0, error: walletsErr.message });

  const wallets = (allWallets ?? []).filter(
    (w) => w.deposit_address != null && w.deposit_address !== ""
  );

  if (!wallets.length) {
    return NextResponse.json({ credited: 0, message: "No deposit addresses found" });
  }

  // Deduplicate addresses
  const seen = new Set<string>();
  const uniqueWallets = wallets.filter((w) => {
    const addr = (w.deposit_address as string).toLowerCase();
    if (seen.has(addr)) return false;
    seen.add(addr);
    return true;
  });

  const addresses = uniqueWallets.map((w) => w.deposit_address as string);
  console.log(`[sweep] Checking ${uniqueWallets.length} unique deposit addresses`);

  let totalCredited = 0;
  const errors: string[] = [];

  try {
    const transfers = await fetchIncomingTransfers(addresses);

    for (const tx of transfers) {
      if (!tx.amount || tx.amount <= 0) continue;

      // Find which wallet owns this address
      const wallet = uniqueWallets.find(
        (w) => (w.deposit_address as string).toLowerCase() === tx.toAddress
      );
      if (!wallet) continue;

      const profileId = wallet.profile_id as string;
      const txHash = tx.txHash;

      // Skip if already processed
      const { count } = await supabase
        .from("deposits")
        .select("id", { count: "exact", head: true })
        .eq("tx_hash", txHash);

      if (count && count > 0) continue;

      // Insert pending deposit
      const { data: dep, error: insertErr } = await supabase
        .from("deposits")
        .insert({
          profile_id: profileId,
          asset_symbol: "USDT",
          network_name: "BNB Smart Chain (BEP-20)",
          amount_expected: tx.amount,
          deposit_address: wallet.deposit_address,
          tx_hash: txHash,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertErr) {
        if (insertErr.code !== "23505") {
          errors.push(`Insert failed for ${txHash}: ${insertErr.message}`);
        }
        continue;
      }

      // Approve deposit
      const { error: rpcErr } = await supabase.rpc("approve_deposit", {
        p_deposit_id: dep.id,
        p_admin_profile_id: adminId,
        p_amount_received: tx.amount,
        p_admin_notes: `Auto-credited by deposit sweep. txHash: ${txHash}`,
      });

      if (rpcErr) {
        errors.push(`Approve failed for ${txHash}: ${rpcErr.message}`);
        continue;
      }

      totalCredited++;
      console.log(`[sweep] Credited ${tx.amount} USDT to ${profileId} — tx ${txHash}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sweep] Fatal error: ${msg}`);
    errors.push(msg);
  }

  console.log(`[sweep] Done. credited=${totalCredited} errors=${errors.length}`, errors.length ? errors : "");
  return NextResponse.json({ credited: totalCredited, errors });
}
