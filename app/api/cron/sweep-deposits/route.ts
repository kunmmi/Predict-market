/**
 * GET /api/cron/sweep-deposits
 *
 * Uses the Moralis API to fetch incoming USDT transfers for every assigned
 * deposit address and credits any that weren't already handled by the webhook.
 *
 * Call this on a schedule (e.g. every minute via cron-job.org).
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";

type MoralisTransfer = {
  transaction_hash: string;
  to_address: string;
  value_decimal: string;
  block_timestamp: string;
};

async function getIncomingUsdtTransfers(address: string, apiKey: string): Promise<MoralisTransfer[]> {
  const url = new URL(`https://deep-index.moralis.io/api/v2.2/${address}/erc20/transfers`);
  url.searchParams.set("chain", "bsc");
  url.searchParams.append("token_addresses", USDT_CONTRACT);
  url.searchParams.set("limit", "50");

  const res = await fetch(url.toString(), {
    headers: { "X-API-Key": apiKey },
  });

  if (!res.ok) throw new Error(`Moralis API error ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { result?: MoralisTransfer[] };
  const transfers = json.result ?? [];

  // Only return incoming transfers to this address
  return transfers.filter(
    (t) => t.to_address.toLowerCase() === address.toLowerCase()
  );
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "MORALIS_API_KEY not set" }, { status: 500 });

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

  let totalCredited = 0;
  const errors: string[] = [];

  for (const wallet of uniqueWallets) {
    const address = wallet.deposit_address as string;
    const profileId = wallet.profile_id as string;

    try {
      const transfers = await getIncomingUsdtTransfers(address, apiKey);

      for (const tx of transfers) {
        const txHash = tx.transaction_hash;
        const amount = parseFloat(tx.value_decimal);
        if (!amount || amount <= 0) continue;

        // Check if already processed
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

  return NextResponse.json({ credited: totalCredited, errors });
}
