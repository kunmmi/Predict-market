import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserWithdrawals } from "@/lib/services/withdrawal-data";
import { withdrawalCreateSchema } from "@/lib/validations/withdrawal";
import { usdToAsset } from "@/lib/services/crypto-price";
import { sendCrypto } from "@/lib/services/tatum-send";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * GET /api/withdrawals
 * Returns the authenticated user's withdrawal history.
 */
export async function GET() {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 },
    );
  }

  const withdrawals = await getUserWithdrawals(profileId);
  return NextResponse.json({ success: true, withdrawals }, { status: 200 });
}

/**
 * POST /api/withdrawals
 *
 * Fully automated flow:
 *  1. Validate input & check available balance
 *  2. Create a pending withdrawal record
 *  3. Convert USD → crypto via live price feed
 *  4. Send crypto via Tatum
 *  5a. Success → call approve_withdrawal RPC (debits wallet, stores tx hash)
 *  5b. Failure → call reject_withdrawal RPC (no wallet debit, stores error)
 *
 * The user gets an immediate success/failure response with the tx hash.
 */
export async function POST(request: Request) {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 },
    );
  }

  // 3 withdrawal requests per minute per user
  if (!rateLimit(`withdrawals:${profileId}`, 3, 60_000)) {
    return rateLimitResponse("Too many withdrawal requests. Please wait before submitting another.");
  }

  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json(
      { success: false, message: "Malformed JSON body." },
      { status: 400 },
    );
  }

  const parsed = withdrawalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid withdrawal input.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { asset_symbol, network_name, amount, withdrawal_address, notes } = parsed.data;
  const usdAmount = Number(amount);

  const supabase = createSupabaseServerClient();
  const supabaseAdmin = createSupabaseAdminClient();
  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;

  if (!systemAdminId) {
    console.error("[withdrawals] SYSTEM_ADMIN_PROFILE_ID is not set");
    return NextResponse.json(
      { success: false, message: "Server configuration error." },
      { status: 500 },
    );
  }

  // 1. Check available balance
  const { data: wallet } = await supabase
    .from("wallets")
    .select("available_balance")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!wallet) {
    return NextResponse.json(
      { success: false, message: "Wallet not found." },
      { status: 404 },
    );
  }

  const available = Number(wallet.available_balance);
  if (usdAmount > available) {
    return NextResponse.json(
      {
        success: false,
        message: `Insufficient balance. You have $${available.toFixed(2)} available.`,
      },
      { status: 400 },
    );
  }

  // 2. Create withdrawal record (pending)
  const { data: withdrawal, error: insertError } = await supabaseAdmin
    .from("withdrawals")
    .insert({
      profile_id: profileId,
      asset_symbol,
      network_name: network_name || null,
      amount: usdAmount,
      withdrawal_address,
      notes: notes || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !withdrawal) {
    return NextResponse.json(
      { success: false, message: "Failed to create withdrawal request." },
      { status: 500 },
    );
  }

  const withdrawalId = withdrawal.id;

  // 3. Convert USD → crypto
  let cryptoAmount: number;
  try {
    cryptoAmount = await usdToAsset(
      usdAmount,
      asset_symbol as "ETH" | "BNB" | "SOL" | "USDT" | "USDC",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Price fetch failed.";
    await supabaseAdmin.rpc("reject_withdrawal", {
      p_withdrawal_id: withdrawalId,
      p_admin_profile_id: systemAdminId,
      p_admin_notes: `Auto-rejected: ${msg}`,
    });
    return NextResponse.json({ success: false, message: msg }, { status: 502 });
  }

  // 4. Send via Tatum
  let txHash: string;
  try {
    txHash = await sendCrypto({
      asset: asset_symbol as "ETH" | "BNB" | "SOL" | "USDT" | "USDC",
      networkName: network_name ?? null,
      toAddress: withdrawal_address,
      cryptoAmount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transaction failed.";
    console.error("[withdrawals] Tatum send failed:", msg);
    await supabaseAdmin.rpc("reject_withdrawal", {
      p_withdrawal_id: withdrawalId,
      p_admin_profile_id: systemAdminId,
      p_admin_notes: `Auto-rejected: ${msg}`,
    });
    return NextResponse.json(
      { success: false, message: `Could not send transaction: ${msg}` },
      { status: 502 },
    );
  }

  // 5. Approve — debits wallet, stores tx hash
  const { error: approveError } = await supabaseAdmin.rpc("approve_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_admin_profile_id: systemAdminId,
    p_admin_notes: `Auto-processed. Sent ${cryptoAmount.toFixed(8)} ${asset_symbol}.`,
    p_tx_hash: txHash,
  });

  if (approveError) {
    console.error("[withdrawals] approve_withdrawal RPC failed:", approveError.message);
    return NextResponse.json(
      { success: false, message: "Transaction was sent but wallet debit failed. Contact support with TX: " + txHash },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      txHash,
      cryptoAmount: cryptoAmount.toFixed(8),
      asset: asset_symbol,
    },
    { status: 200 },
  );
}
