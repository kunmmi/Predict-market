import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  FIXED_WITHDRAWAL_ASSET,
  FIXED_WITHDRAWAL_NETWORK,
  withdrawalCreateSchema,
} from "@/lib/validations/withdrawal";
import { usdToAsset } from "@/lib/services/crypto-price";
import { sendCrypto } from "@/lib/services/tatum-send";

async function ensurePlatformWalletId() {
  const supabase = createSupabaseAdminClient();
  const existing = await supabase
    .from("platform_wallets")
    .select("id, available_balance")
    .eq("wallet_key", "general_admin")
    .maybeSingle();

  if (existing.data) {
    return existing.data;
  }

  const inserted = await supabase
    .from("platform_wallets")
    .insert({ wallet_key: "general_admin" })
    .select("id, available_balance")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? "Failed to initialize platform wallet.");
  }

  return inserted.data;
}

export async function POST(request: Request) {
  let adminProfileId: string;
  try {
    const { profile } = await requireAdminForApi();
    adminProfileId = profile.id;
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 401 },
    );
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

  const { amount, withdrawal_address, notes } = parsed.data;
  const asset_symbol = FIXED_WITHDRAWAL_ASSET;
  const network_name = FIXED_WITHDRAWAL_NETWORK;
  const usdAmount = Number(amount);
  const supabase = createSupabaseAdminClient();

  let walletRow: { id: string; available_balance: string | number };
  try {
    walletRow = await ensurePlatformWalletId();
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }

  if (usdAmount > Number(walletRow.available_balance)) {
    return NextResponse.json(
      { success: false, message: "Insufficient platform wallet balance." },
      { status: 400 },
    );
  }

  const { data: withdrawal, error: insertError } = await supabase
    .from("platform_withdrawals")
    .insert({
      platform_wallet_id: walletRow.id,
      requested_by_admin_profile_id: adminProfileId,
      asset_symbol,
      network_name: network_name || null,
      amount: usdAmount,
      withdrawal_address,
      admin_notes: notes || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !withdrawal) {
    return NextResponse.json(
      { success: false, message: insertError?.message ?? "Failed to create platform withdrawal." },
      { status: 500 },
    );
  }

  const withdrawalId = withdrawal.id as string;

  let cryptoAmount: number;
  try {
    cryptoAmount = await usdToAsset(
      usdAmount,
      asset_symbol as "ETH" | "BNB" | "SOL" | "USDT" | "USDC",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Price fetch failed.";
    await supabase
      .from("platform_withdrawals")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        admin_notes: notes ? `${notes}\n\nAuto-rejected: ${message}` : `Auto-rejected: ${message}`,
      })
      .eq("id", withdrawalId);

    return NextResponse.json({ success: false, message }, { status: 502 });
  }

  let txHash: string;
  try {
    txHash = await sendCrypto({
      asset: asset_symbol as "ETH" | "BNB" | "SOL" | "USDT" | "USDC",
      networkName: network_name ?? null,
      toAddress: withdrawal_address,
      cryptoAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transaction failed.";

    await supabase
      .from("platform_withdrawals")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        admin_notes: notes ? `${notes}\n\nAuto-rejected: ${message}` : `Auto-rejected: ${message}`,
      })
      .eq("id", withdrawalId);

    return NextResponse.json(
      { success: false, message: `Could not send transaction: ${message}` },
      { status: 502 },
    );
  }

  const { error: debitError } = await supabase.rpc("debit_platform_wallet", {
    p_amount: usdAmount,
    p_transaction_type: "withdrawal_debit",
    p_reference_table: "platform_withdrawals",
    p_reference_id: withdrawalId,
    p_asset_symbol: "USDT",
    p_description: `Platform withdrawal sent as ${asset_symbol}`,
    p_wallet_key: "general_admin",
    p_admin_profile_id: adminProfileId,
  });

  if (debitError) {
    return NextResponse.json(
      {
        success: false,
        message: `Transaction was sent but platform wallet debit failed. Contact support with TX: ${txHash}`,
      },
      { status: 500 },
    );
  }

  const approvedNotes = notes
    ? `${notes}\n\nSent ${cryptoAmount.toFixed(8)} ${asset_symbol}. TX: ${txHash}`
    : `Sent ${cryptoAmount.toFixed(8)} ${asset_symbol}. TX: ${txHash}`;

  await Promise.all([
    supabase
      .from("platform_withdrawals")
      .update({
        status: "approved",
        tx_hash: txHash,
        crypto_amount: cryptoAmount,
        approved_at: new Date().toISOString(),
        admin_notes: approvedNotes,
      })
      .eq("id", withdrawalId),
    supabase.from("admin_logs").insert({
      admin_profile_id: adminProfileId,
      action_type: "wallet_adjusted",
      target_table: "platform_withdrawals",
      target_id: withdrawalId,
      notes: approvedNotes,
    }),
  ]);

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
