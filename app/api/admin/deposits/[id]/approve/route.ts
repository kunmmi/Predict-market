import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendDepositApprovedEmail } from "@/lib/services/email-notifications";
import { createProvider, initializeDepositAddress } from "@/lib/blockchain/bsc-sweep";

const approveSchema = z.object({
  amountReceived: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "Must be a positive number.")
    .refine((v) => Number.parseFloat(v) > 0, "Amount must be greater than zero."),
  notes: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/deposits/[id]/approve
 * Body: { amountReceived: string, notes?: string }
 *
 * Calls the approve_deposit DB function which:
 *   - marks deposit as approved
 *   - credits the user's wallet
 *   - writes an admin_log entry
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let adminProfileId: string;
  try {
    const { profile } = await requireAdminForApi();
    adminProfileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => undefined);
  if (!body) {
    return NextResponse.json({ success: false, message: "Malformed request." }, { status: 400 });
  }

  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid input.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { amountReceived, notes } = parsed.data;

  try {
    const supabase = createSupabaseAdminClient();

    // Security: fetch deposit before approving
    const { data: depositCheck } = await supabase
      .from("deposits")
      .select("profile_id, tx_hash")
      .eq("id", params.id)
      .maybeSingle();

    if (!depositCheck) {
      return NextResponse.json({ success: false, message: "Deposit not found." }, { status: 404 });
    }

    // Block self-approval — admin cannot approve their own deposit
    if (depositCheck.profile_id === adminProfileId) {
      return NextResponse.json(
        { success: false, message: "You cannot approve your own deposit." },
        { status: 403 },
      );
    }

    // Block fake/zeroed tx hashes — must be a real 66-char hex string, not all zeros
    const txHash: string = depositCheck.tx_hash ?? "";
    const isZeroHash = /^0x0+$/i.test(txHash);
    const isValidHash = /^0x[0-9a-f]{64}$/i.test(txHash);
    if (!txHash || !isValidHash || isZeroHash) {
      return NextResponse.json(
        { success: false, message: "Deposit has an invalid or unverified transaction hash. Verify the on-chain transaction before approving." },
        { status: 400 },
      );
    }

    const { error } = await supabase.rpc("approve_deposit", {
      p_deposit_id: params.id,
      p_admin_profile_id: adminProfileId,
      p_amount_received: Number.parseFloat(amountReceived),
      p_admin_notes: notes ?? null,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 },
      );
    }

    // Fetch deposit + user details for email + background init
    const { data: deposit } = await supabase
      .from("deposits")
      .select("amount_received, asset_symbol, profile_id, profiles(email, full_name)")
      .eq("id", params.id)
      .maybeSingle();

    if (deposit) {
      const profile = Array.isArray(deposit.profiles) ? deposit.profiles[0] : deposit.profiles;

      // Email notification (non-blocking)
      sendDepositApprovedEmail({
        toEmail: profile?.email ?? "",
        toName: profile?.full_name ?? null,
        amount: Number(deposit.amount_received ?? parsed.data.amountReceived),
        assetSymbol: deposit.asset_symbol,
      }).catch(() => {});

      // Pre-initialize deposit address in background — so when the user
      // withdraws later, the address is already approved and the fallback
      // is a single transferFrom rather than 3 sequential transactions.
      void (async () => {
        try {
          const { data: wallet } = await supabase
            .from("wallets")
            .select("deposit_address, deposit_address_index, sweep_approved_at")
            .eq("profile_id", deposit.profile_id)
            .maybeSingle();

          if (
            !wallet?.deposit_address ||
            wallet.deposit_address_index === null ||
            wallet.sweep_approved_at  // already initialized
          ) return;

          const provider = createProvider();
          const result = await initializeDepositAddress(
            wallet.deposit_address,
            wallet.deposit_address_index as number,
            provider,
          );

          if (result.status === "initialized") {
            await supabase
              .from("wallets")
              .update({ sweep_approved_at: new Date().toISOString() })
              .eq("deposit_address", wallet.deposit_address);
          }
        } catch (err) {
          // Non-critical — log and move on. Fallback withdrawal will
          // handle init on demand if this didn't run.
          console.warn("[deposit-approve] background init failed:", err instanceof Error ? err.message : err);
        }
      })();
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
