/**
 * POST /api/webhooks/moralis
 *
 * Receives real-time notifications from Moralis Streams when USDT (BEP-20)
 * is sent to any of our deposit addresses, and credits the user's wallet.
 *
 * Moralis sends two webhooks per event:
 *   • confirmed: false  — when seen in mempool / 1st block (skipped)
 *   • confirmed: true   — after configured confirmations (we credit here)
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";

type Erc20Transfer = {
  transactionHash: string;
  contract: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimals: string;
  valueWithDecimals: string;
};

type MoralisWebhookPayload = {
  confirmed?: boolean;
  chainId?: string;
  streamId?: string;
  tag?: string;
  erc20Transfers?: Erc20Transfer[];
};

/** Verify Moralis HMAC signature (if MORALIS_WEBHOOK_SECRET is set). */
function verifySignature(rawBody: string, headerSignature: string | null): boolean {
  const secret = process.env.MORALIS_WEBHOOK_SECRET;
  if (!secret) return true; // signature verification disabled
  if (!headerSignature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(headerSignature, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    console.warn("[moralis-webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MoralisWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MoralisWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only process confirmed events (Moralis sends two: unconfirmed then confirmed)
  if (!payload.confirmed) {
    return NextResponse.json({ ok: true, skipped: "unconfirmed" });
  }

  const transfers = payload.erc20Transfers ?? [];
  if (transfers.length === 0) {
    return NextResponse.json({ ok: true, credited: 0 });
  }

  const supabase = createSupabaseAdminClient();
  const adminId = process.env.SYSTEM_ADMIN_PROFILE_ID;
  if (!adminId) {
    console.error("[moralis-webhook] SYSTEM_ADMIN_PROFILE_ID not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let credited = 0;
  const results: string[] = [];

  for (const t of transfers) {
    // Only USDT BEP-20
    if (t.contract.toLowerCase() !== USDT_CONTRACT.toLowerCase()) continue;
    if (t.tokenSymbol !== "USDT") continue;

    const toAddress = t.to.toLowerCase();
    const amount = parseFloat(t.valueWithDecimals);
    const txHash = t.transactionHash;

    if (!amount || amount <= 0) continue;

    // Find the wallet that owns this address
    const { data: wallets } = await supabase
      .from("wallets")
      .select("profile_id, deposit_address");

    const wallet = (wallets ?? []).find(
      (w) => (w.deposit_address as string | null)?.toLowerCase() === toAddress
    );

    if (!wallet) {
      console.warn(`[moralis-webhook] No wallet found for ${toAddress}`);
      continue;
    }

    const profileId = wallet.profile_id as string;

    // Skip if already processed
    const { count } = await supabase
      .from("deposits")
      .select("id", { count: "exact", head: true })
      .eq("tx_hash", txHash);

    if (count && count > 0) {
      results.push(`${txHash}: already credited`);
      continue;
    }

    // Insert pending deposit
    const { data: dep, error: insertErr } = await supabase
      .from("deposits")
      .insert({
        profile_id: profileId,
        asset_symbol: "USDT",
        network_name: "BNB Smart Chain (BEP-20)",
        amount_expected: amount,
        deposit_address: wallet.deposit_address,
        tx_hash: txHash,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr) {
      if (insertErr.code !== "23505") {
        console.error(`[moralis-webhook] Insert error for ${txHash}:`, insertErr);
        results.push(`${txHash}: insert failed`);
      }
      continue;
    }

    // Approve
    const { error: rpcErr } = await supabase.rpc("approve_deposit", {
      p_deposit_id: dep.id,
      p_admin_profile_id: adminId,
      p_amount_received: amount,
      p_admin_notes: `Auto-credited via Moralis Stream. txHash: ${txHash}`,
    });

    if (rpcErr) {
      console.error(`[moralis-webhook] Approve error for ${txHash}:`, rpcErr);
      results.push(`${txHash}: approve failed`);
      continue;
    }

    credited += amount;
    console.log(`[moralis-webhook] Credited ${amount} USDT to ${profileId} — tx ${txHash}`);
    results.push(`${txHash}: credited ${amount}`);
  }

  return NextResponse.json({ ok: true, credited, results });
}
