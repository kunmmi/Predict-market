import { NextResponse } from "next/server";

import { depositCreateSchema } from "@/lib/validations/deposit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { getUserDeposits } from "@/lib/services/deposit-data";
import { getDepositAddress } from "@/lib/config/deposit-addresses";
import type { DepositAssetSymbol } from "@/types/enums";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * GET /api/deposits
 *
 * Returns the authenticated user's deposit history.
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

  const deposits = await getUserDeposits(profileId);
  return NextResponse.json({ success: true, deposits }, { status: 200 });
}

/**
 * POST /api/deposits
 *
 * Creates a pending deposit request for the authenticated user.
 * The deposit is manually reviewed and approved/rejected by an admin.
 */
export async function POST(request: Request) {
  // Require authentication
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

  // 5 deposit requests per minute per user
  if (!rateLimit(`deposits:${profileId}`, 5, 60_000)) {
    return rateLimitResponse("Too many deposit requests. Please wait before submitting another.");
  }

  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json(
      { success: false, message: "Malformed JSON body." },
      { status: 400 },
    );
  }

  const parsed = depositCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid deposit input.",
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { asset_symbol, network_name, amount_expected, tx_hash, deposit_address } =
    parsed.data;

  // Auto-populate deposit_address from platform config if user didn't provide one.
  // This ensures tier-2 webhook matching works even when the user omits the address field.
  const resolvedDepositAddress =
    deposit_address?.trim() ||
    getDepositAddress(asset_symbol as DepositAssetSymbol) ||
    null;

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("deposits")
    .insert({
      profile_id: profileId,
      asset_symbol,
      network_name: network_name || null,
      amount_expected: amount_expected || null,
      tx_hash: tx_hash || null,
      deposit_address: resolvedDepositAddress,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: "Failed to submit deposit request." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, depositId: data.id }, { status: 201 });
}
