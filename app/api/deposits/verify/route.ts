/**
 * POST /api/deposits/verify
 *
 * Self-heal endpoint for missed Tatum webhooks.
 * User provides their deposit ID; we verify the tx hash on-chain and
 * auto-approve if the transaction is confirmed and sent to the platform address.
 *
 * Body: { deposit_id: string }
 */

import { NextResponse } from "next/server";
import { ethers } from "ethers";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ASSET_ADDRESS_CONFIG } from "@/lib/config/deposit-addresses";

// BSC USDT contract address
const BSC_USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const BSC_RPC = "https://bsc-dataseed1.binance.org/";

// ERC-20 Transfer event topic
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export async function POST(request: Request) {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { deposit_id?: string } | null;
  const depositId = body?.deposit_id?.trim();

  if (!depositId) {
    return NextResponse.json({ success: false, message: "deposit_id is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;

  if (!systemAdminId) {
    return NextResponse.json({ success: false, message: "Server configuration error." }, { status: 500 });
  }

  // 1. Load the deposit — must belong to this user and be pending
  const { data: deposit } = await supabase
    .from("deposits")
    .select("id, status, tx_hash, asset_symbol, amount_expected, deposit_address")
    .eq("id", depositId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!deposit) {
    return NextResponse.json({ success: false, message: "Deposit not found." }, { status: 404 });
  }

  if (deposit.status !== "pending") {
    return NextResponse.json(
      { success: false, message: `Deposit is already ${deposit.status as string}.` },
      { status: 400 },
    );
  }

  const txHash = (deposit.tx_hash as string | null)?.trim();
  if (!txHash) {
    return NextResponse.json(
      { success: false, message: "No transaction hash on this deposit. Please add your tx hash first." },
      { status: 400 },
    );
  }

  // 2. Check this tx hash hasn't already been used in any other approved deposit
  // Prevents: (a) double-spend — same hash on two deposits for the same user
  //           (b) hash theft — attacker copies a public tx hash to their own deposit
  const { data: alreadyUsed } = await supabase
    .from("deposits")
    .select("id, profile_id")
    .eq("tx_hash", txHash)
    .eq("status", "approved")
    .neq("id", depositId)
    .maybeSingle();

  if (alreadyUsed) {
    const isOwnDeposit = (alreadyUsed.profile_id as string) === profileId;
    return NextResponse.json(
      {
        success: false,
        message: isOwnDeposit
          ? "This transaction has already been used to credit one of your deposits."
          : "This transaction hash has already been claimed. If you believe this is an error, contact support.",
      },
      { status: 409 },
    );
  }

  // 4. Verify on-chain
  const platformAddress = (deposit.deposit_address as string | null) ??
    ASSET_ADDRESS_CONFIG["USDT"].address ?? "";

  let verifiedAmount: string;
  try {
    verifiedAmount = await verifyBscUsdtTx(txHash, platformAddress.toLowerCase());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "On-chain verification failed.";
    return NextResponse.json({ success: false, message: msg }, { status: 422 });
  }

  // 5. Approve the deposit
  const { error: rpcError } = await supabase.rpc("approve_deposit", {
    p_deposit_id: depositId,
    p_admin_profile_id: systemAdminId,
    p_amount_received: parseFloat(verifiedAmount),
    p_admin_notes: `Auto-approved via on-chain verification. txHash: ${txHash}`,
  });

  if (rpcError) {
    console.error("[verify-deposit] approve_deposit RPC failed:", rpcError.message);
    return NextResponse.json({ success: false, message: "Verification passed but approval failed. Contact support." }, { status: 500 });
  }

  return NextResponse.json({ success: true, amountReceived: verifiedAmount });
}

/**
 * Verifies a BSC USDT transfer transaction.
 * Returns the human-readable USDT amount on success.
 * Throws a descriptive error if the tx is invalid, unconfirmed, or doesn't match.
 */
async function verifyBscUsdtTx(txHash: string, expectedRecipient: string): Promise<string> {
  const provider = new ethers.JsonRpcProvider(BSC_RPC);

  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    throw new Error("Transaction not found on BSC. It may still be pending — please wait for confirmation.");
  }

  if (receipt.status !== 1) {
    throw new Error("Transaction failed on-chain. No funds were transferred.");
  }

  // Find the USDT Transfer log matching our platform address
  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() !== BSC_USDT_CONTRACT.toLowerCase() ||
      log.topics[0] !== TRANSFER_TOPIC ||
      log.topics.length < 3
    ) {
      continue;
    }

    // topics[2] is the recipient address (padded to 32 bytes)
    const recipient = "0x" + log.topics[2]!.slice(-40);
    if (recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
      continue;
    }

    // Decode the amount (18 decimals)
    const amountRaw = BigInt(log.data);
    const amount = ethers.formatUnits(amountRaw, 18);
    return amount;
  }

  throw new Error("No USDT transfer to the platform address found in this transaction.");
}
