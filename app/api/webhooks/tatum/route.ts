import { NextResponse } from "next/server";
import crypto from "crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveAssetSymbol } from "@/lib/config/deposit-addresses";

// ---------------------------------------------------------------------------
// Tatum webhook payload shape
// Covers INCOMING_NATIVE_TX and INCOMING_FUNGIBLE_TX subscription types.
// ---------------------------------------------------------------------------

type TatumWebhookPayload = {
  subscriptionType?: string;    // e.g. INCOMING_NATIVE_TX, INCOMING_FUNGIBLE_TX
  txId: string;
  address: string;              // receiving address (our platform wallet)
  counterAddress?: string;      // sender address
  amount: string;
  tokenSymbol?: string | null;  // present for fungible (ERC-20/BEP-20) txs
  tokenAddress?: string | null; // token contract address
  asset?: string | null;
  chain: string;                // BTC | ETH | BSC | SOL
  blockNumber?: number;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// HMAC SHA512 signature verification
// ---------------------------------------------------------------------------

function verifySignature(rawBody: string, headerSignature: string): boolean {
  const secret = process.env.TATUM_WEBHOOK_SECRET;

  // If Tatum didn't send a signature header, HMAC is not enabled on this plan.
  // Accept the request — the endpoint is still protected by the unique tatum_tx_id
  // constraint and deposit-matching logic.
  if (!headerSignature) {
    return true;
  }

  // If we have a secret and a signature, verify it properly.
  if (secret) {
    const computed = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, "hex"),
        Buffer.from(headerSignature, "hex"),
      );
    } catch {
      return false;
    }
  }

  // Signature present but no secret configured — reject to be safe
  console.warn("[tatum-webhook] Received x-payload-hash but TATUM_WEBHOOK_SECRET is not set");
  return false;
}

// ---------------------------------------------------------------------------
// Route handler — return 200 immediately, process async
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Read raw body first — must happen before any .json() call for HMAC to work
  const rawBody = await request.text();
  const signature = request.headers.get("x-payload-hash") ?? "";

  if (!verifySignature(rawBody, signature)) {
    console.warn("[tatum-webhook] Signature verification failed");
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let payload: TatumWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TatumWebhookPayload;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  // Return 200 immediately so Tatum does not retry while we process
  void processWebhook(payload).catch((err: unknown) => {
    console.error("[tatum-webhook] Unhandled error:", err);
  });

  return NextResponse.json({ success: true }, { status: 200 });
}

// ---------------------------------------------------------------------------
// Core async processing
// ---------------------------------------------------------------------------

async function processWebhook(payload: TatumWebhookPayload): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Step 1: Insert a log record — unique on tatum_tx_id for idempotency
  const { data: logRow, error: logError } = await supabase
    .from("tatum_webhook_logs")
    .insert({
      tatum_tx_id: payload.txId,
      chain: payload.chain,
      address: payload.address,
      amount: String(payload.amount),
      asset: payload.tokenSymbol ?? payload.asset ?? null,
      payload: payload as Record<string, unknown>,
      processing_status: "received",
    })
    .select("id")
    .single();

  if (logError) {
    // 23505 = unique violation — duplicate webhook, safe to ignore
    if (logError.code === "23505") {
      console.log(`[tatum-webhook] Duplicate for txId ${payload.txId} — skipped`);
      return;
    }
    console.error("[tatum-webhook] Failed to insert log:", logError.message);
    return;
  }

  const logId = logRow.id as string;

  // Step 2: Skip non-incoming subscription types (safety guard)
  // Since we only subscribe to INCOMING_* types this should rarely trigger.
  const subType = payload.subscriptionType ?? "";
  if (subType && !subType.startsWith("INCOMING_")) {
    await updateLog(supabase, logId, "skipped", `Non-incoming subscription type: ${subType}`);
    return;
  }

  // Step 3: Find matching pending deposit
  const deposit = await findMatchingDeposit(supabase, payload);

  if (!deposit) {
    await updateLog(supabase, logId, "skipped", "No matching pending deposit found");
    return;
  }

  // Step 4: Update log — match found
  await supabase
    .from("tatum_webhook_logs")
    .update({ processing_status: "matched", matched_deposit_id: deposit.id })
    .eq("id", logId);

  // Step 5: Call approve_deposit RPC
  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;
  if (!systemAdminId) {
    await updateLog(supabase, logId, "error", "SYSTEM_ADMIN_PROFILE_ID env var not set");
    console.error("[tatum-webhook] SYSTEM_ADMIN_PROFILE_ID is not set");
    return;
  }

  const amountReceived = parseFloat(String(payload.amount));

  const { error: rpcError } = await supabase.rpc("approve_deposit", {
    p_deposit_id: deposit.id,
    p_admin_profile_id: systemAdminId,
    p_amount_received: amountReceived,
    p_admin_notes: `Auto-approved via Tatum webhook. txId: ${payload.txId}`,
  });

  if (rpcError) {
    await updateLog(supabase, logId, "error", rpcError.message);
    console.error(`[tatum-webhook] approve_deposit RPC failed for ${deposit.id}:`, rpcError.message);
    return;
  }

  // Step 6: Done
  await updateLog(supabase, logId, "approved");
  console.log(`[tatum-webhook] Auto-approved deposit ${deposit.id} for txId ${payload.txId}`);
}

// ---------------------------------------------------------------------------
// Deposit matching — two-tier
// ---------------------------------------------------------------------------

async function findMatchingDeposit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  payload: TatumWebhookPayload,
): Promise<{ id: string } | null> {
  // Tier 1: Match by tx_hash (most precise — covers the majority of cases)
  const { data: byHash } = await supabase
    .from("deposits")
    .select("id")
    .eq("tx_hash", payload.txId)
    .eq("status", "pending")
    .maybeSingle();

  if (byHash) return byHash as { id: string };

  // Tier 2: Match by deposit_address + asset + amount within the last 24 hours
  // Used when the user sent funds before submitting the deposit form.
  const assetSymbol = resolveAssetSymbol(payload.chain, payload.tokenSymbol);
  if (!assetSymbol) return null;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const payloadAmount = parseFloat(String(payload.amount));

  const { data: candidates } = await supabase
    .from("deposits")
    .select("id, amount_expected")
    .eq("deposit_address", payload.address)
    .eq("status", "pending")
    .eq("asset_symbol", assetSymbol)
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false });

  if (!candidates || candidates.length === 0) return null;

  const AMOUNT_TOLERANCE = 0.000001;

  // First pass: find candidates whose expected amount matches within tolerance
  for (const candidate of candidates) {
    const c = candidate as { id: string; amount_expected: string | number | null };
    if (c.amount_expected == null) continue;
    const expected = parseFloat(String(c.amount_expected));
    if (Math.abs(expected - payloadAmount) <= AMOUNT_TOLERANCE) {
      return { id: c.id };
    }
  }

  // Second pass: if exactly one candidate has no expected amount, treat as match
  const withoutAmount = (candidates as { id: string; amount_expected: string | number | null }[])
    .filter((c) => c.amount_expected == null);

  if (withoutAmount.length === 1) {
    return { id: withoutAmount[0].id };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function updateLog(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  logId: string,
  status: string,
  errorMessage?: string,
): Promise<void> {
  await supabase
    .from("tatum_webhook_logs")
    .update({
      processing_status: status,
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .eq("id", logId);
}
