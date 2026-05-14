/**
 * GET /api/cron/sweep-deposits
 *
 * Polls Tatum for recent USDT transfers to every assigned deposit address
 * and credits any that weren't already handled by the webhook.
 *
 * Call this on a schedule (e.g. every 2 minutes via Vercel Cron or an
 * external cron service).  Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const USDT_BSC = "0x55d398326f99059ff775485246999027b3197955";

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

  const apiKey = process.env.TATUM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "TATUM_API_KEY not set" }, { status: 500 });

  let totalCredited = 0;
  const errors: string[] = [];

  for (const wallet of wallets) {
    const address = wallet.deposit_address as string;
    const profileId = wallet.profile_id as string;

    try {
      // Fetch recent incoming USDT transactions for this address
      const res = await fetch(
        `https://api.tatum.io/v4/data/transactions?chain=bsc&addresses=${address}&transactionTypes=fungible&pageSize=20`,
        { headers: { "x-api-key": apiKey } },
      );

      if (!res.ok) continue;

      type TxRow = { hash: string; amount: string; tokenAddress?: string; transactionSubtype?: string };
      const json = (await res.json()) as { result?: TxRow[] };
      const txs = json.result ?? [];

      for (const tx of txs) {
        // Only incoming USDT
        if (tx.transactionSubtype !== "incoming") continue;
        if (tx.tokenAddress?.toLowerCase() !== USDT_BSC) continue;

        const amount = parseFloat(tx.amount);
        if (!amount || amount <= 0) continue;

        // Check if already processed (deposit record with this tx_hash exists)
        const { data: existing } = await supabase
          .from("deposits")
          .select("id")
          .eq("tx_hash", tx.hash)
          .maybeSingle();

        if (existing) continue; // Already handled

        // Create + approve deposit
        const { data: dep, error: insertErr } = await supabase
          .from("deposits")
          .insert({
            profile_id: profileId,
            asset_symbol: "USDT",
            network_name: "BNB Smart Chain (BEP-20)",
            amount_expected: amount,
            deposit_address: address,
            tx_hash: tx.hash,
            status: "pending",
          })
          .select("id")
          .single();

        if (insertErr) {
          // 23505 = duplicate tx_hash — race condition, safe to skip
          if (insertErr.code !== "23505") {
            errors.push(`Insert failed for ${tx.hash}: ${insertErr.message}`);
          }
          continue;
        }

        const { error: rpcErr } = await supabase.rpc("approve_deposit", {
          p_deposit_id: dep.id,
          p_admin_profile_id: adminId,
          p_amount_received: amount,
          p_admin_notes: `Auto-credited by deposit sweep. txHash: ${tx.hash}`,
        });

        if (rpcErr) {
          errors.push(`Approve failed for ${tx.hash}: ${rpcErr.message}`);
          continue;
        }

        totalCredited++;
        console.log(`[sweep-deposits] Credited ${amount} USDT to ${profileId} — tx ${tx.hash}`);
      }
    } catch (err) {
      errors.push(`Error processing ${address}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ credited: totalCredited, errors });
}
