/**
 * GET /api/cron/sweep-deposits
 *
 * Polls the BSC chain directly (via PublicNode RPC) for incoming USDT
 * transfers to every assigned deposit address and credits any that weren't
 * already handled by the webhook.
 *
 * Call this on a schedule (e.g. every minute via cron-job.org).
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BSC_RPC = "https://bsc-rpc.publicnode.com";
const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";
// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
// BSC produces ~3 blocks/second; 7200 blocks ≈ 6 hours — safe overlap window
const BLOCK_LOOKBACK = 7200;

/** Convert a 32-byte ABI-encoded uint256 to a USDT float (18 decimals). */
function decodeUsdtAmount(data: string): number {
  const raw = BigInt(data);
  // Divide in two steps to stay within safe integer range (supports up to ~9M USDT)
  return Number(raw / BigInt(1e12)) / 1e6;
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BSC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createSupabaseAdminClient();
  const adminId = process.env.SYSTEM_ADMIN_PROFILE_ID;
  if (!adminId) return NextResponse.json({ error: "SYSTEM_ADMIN_PROFILE_ID not set" }, { status: 500 });

  // Fetch all wallets that have a unique deposit address assigned
  const { data: wallets, error: walletsErr } = await supabase
    .from("wallets")
    .select("profile_id, deposit_address")
    .not("deposit_address", "is", null);

  if (walletsErr || !wallets?.length) {
    return NextResponse.json({ credited: 0, message: "No deposit addresses found" });
  }

  // Deduplicate addresses (edge case: multiple wallet rows for same address)
  const seen = new Set<string>();
  const uniqueWallets = wallets.filter((w) => {
    const addr = (w.deposit_address as string).toLowerCase();
    if (seen.has(addr)) return false;
    seen.add(addr);
    return true;
  });

  // Get current block number
  let latestBlock: number;
  try {
    const blockHex = (await rpc("eth_blockNumber", [])) as string;
    latestBlock = parseInt(blockHex, 16);
  } catch (err) {
    return NextResponse.json({ error: `Failed to get block number: ${String(err)}` }, { status: 500 });
  }
  const fromBlock = "0x" + Math.max(0, latestBlock - BLOCK_LOOKBACK).toString(16);

  const debug = new URL(request.url).searchParams.get("debug") === "1";
  const debugInfo: unknown[] = [];

  let totalCredited = 0;
  const errors: string[] = [];

  for (const wallet of uniqueWallets) {
    const address = wallet.deposit_address as string;
    const profileId = wallet.profile_id as string;
    // Pad address to 32 bytes for topic filter
    const paddedAddress = "0x000000000000000000000000" + address.toLowerCase().slice(2);

    try {
      type Log = { transactionHash: string; data: string; removed?: boolean };
      const logs = (await rpc("eth_getLogs", [
        {
          fromBlock,
          toBlock: "latest",
          address: USDT_CONTRACT,
          topics: [TRANSFER_TOPIC, null, paddedAddress],
        },
      ])) as Log[];

      if (debug) debugInfo.push({ address, fromBlock, logsFound: logs.length, hashes: logs.map(l => l.transactionHash) });

      for (const log of logs) {
        if (log.removed) continue; // reorged-out tx

        const txHash = log.transactionHash;
        const amount = decodeUsdtAmount(log.data);
        if (!amount || amount <= 0) continue;

        // Check if already processed (use count to avoid maybeSingle() blowing up
        // when duplicate rows exist from a previous bug)
        const { count } = await supabase
          .from("deposits")
          .select("id", { count: "exact", head: true })
          .eq("tx_hash", txHash);

        if (count && count > 0) continue;

        // Create + approve deposit
        const { data: dep, error: insertErr } = await supabase
          .from("deposits")
          .insert({
            profile_id: profileId,
            asset_symbol: "USDT",
            network_name: "BNB Smart Chain (BEP-20)",
            amount_expected: amount,
            deposit_address: address,
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

        const { error: rpcErr } = await supabase.rpc("approve_deposit", {
          p_deposit_id: dep.id,
          p_admin_profile_id: adminId,
          p_amount_received: amount,
          p_admin_notes: `Auto-credited by deposit sweep. txHash: ${txHash}`,
        });

        if (rpcErr) {
          errors.push(`Approve failed for ${txHash}: ${rpcErr.message}`);
          continue;
        }

        totalCredited++;
        console.log(`[sweep-deposits] Credited ${amount} USDT to ${profileId} — tx ${txHash}`);
      }
    } catch (err) {
      errors.push(`Error processing ${address}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ credited: totalCredited, errors, ...(debug ? { debug: debugInfo } : {}) });
}
