import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tradePlaceSchema } from "@/lib/validations/trade";

/**
 * POST /api/trades
 * Places a trade by calling the place_trade RPC.
 *
 * Fee note: The place_trade RPC has a known double-debit issue when fee_amount > 0
 * (it debits amount+fee as trade_debit, then also fee_amount as fee_debit).
 * For MVP we pass fee_amount to the RPC so commission is generated correctly.
 * The total debit from the RPC will be: amount + fee_amount (trade_debit) + fee_amount (fee_debit).
 * To avoid this, callers should pass the fee as part of the validation
 * but the RPC p_fee_amount is passed as 0 so only amount is debited once.
 * Commission tracking is thus disabled at RPC level in this MVP.
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

  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json(
      { success: false, message: "Malformed JSON body." },
      { status: 400 },
    );
  }

  const parsed = tradePlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { market_id, side, amount, price } = parsed.data;

  // Use the admin client (service role) for the RPC call so that
  // place_trade can SELECT...FOR UPDATE on markets and INSERT into trades/positions
  // without being blocked by RLS (the user has no UPDATE/INSERT policies on those tables).
  // Authentication is already verified above — profileId is the authenticated user's ID.
  const supabaseAdmin = createSupabaseAdminClient();

  // Call place_trade RPC — pass fee_amount as 0 to avoid double-debit bug
  // The fee is shown to the user in the UI but not debited at RPC level in MVP.
  const { data, error } = await supabaseAdmin.rpc("place_trade", {
    p_profile_id: profileId,
    p_market_id: market_id,
    p_side: side,
    p_amount: parseFloat(amount),
    p_price: parseFloat(price),
    p_fee_amount: 0,
  });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message ?? "Trade failed." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, tradeId: data }, { status: 201 });
}

/**
 * GET /api/trades
 * Returns the current user's recent trades.
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

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("trades")
    .select(
      "id, market_id, side, amount, price, fee_amount, position_units, status, created_at",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch trades." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, trades: data ?? [] });
}
