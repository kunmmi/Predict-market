import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tradePlaceSchema } from "@/lib/validations/trade";
import { sendCommissionEarnedEmail } from "@/lib/services/email-notifications";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { updatePriceAfterTrade } from "@/lib/services/dynamic-pricing";

/**
 * POST /api/trades
 * Places a trade by calling the place_trade RPC.
 *
 * Fee note: The place_trade RPC debits `amount` as trade_debit and then
 * separately debits `fee_amount` as fee_debit. Commissions are generated
 * automatically inside the RPC when fee_amount > 0 and the user was referred
 * by an active promoter.
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

  // 10 trades per minute per user
  if (!rateLimit(`trades:${profileId}`, 10, 60_000)) {
    return rateLimitResponse("Too many trades. Please wait before placing another.");
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

  const { market_id, side, amount, price, fee_amount } = parsed.data;

  // Use the admin client (service role) for the RPC call so that
  // place_trade can SELECT...FOR UPDATE on markets and INSERT into trades/positions
  // without being blocked by RLS (the user has no UPDATE/INSERT policies on those tables).
  // Authentication is already verified above — profileId is the authenticated user's ID.
  const supabaseAdmin = createSupabaseAdminClient();

  // Pass the actual fee amount so the RPC records it correctly and generates
  // promoter commissions. The RPC debits `amount` as trade_debit and
  // `fee_amount` separately as fee_debit — no double-debit.
  const { data, error } = await supabaseAdmin.rpc("place_trade", {
    p_profile_id: profileId,
    p_market_id: market_id,
    p_side: side,
    p_amount: parseFloat(amount),
    p_price: parseFloat(price),
    p_fee_amount: parseFloat(fee_amount),
  });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message ?? "Trade failed." },
      { status: 400 },
    );
  }

  // Recalculate and store new YES/NO prices based on updated trade volumes (non-blocking)
  void updatePriceAfterTrade(market_id);

  // Notify the promoter if a commission was generated (non-blocking)
  if (data && parseFloat(fee_amount) > 0) {
    void (async () => {
      try {
        const { data: commission } = await supabaseAdmin
          .from("commissions")
          .select("commission_amount, promoters(profiles(email, full_name))")
          .eq("trade_id", data)
          .maybeSingle();

        if (!commission) return;
        const promoter = Array.isArray(commission.promoters)
          ? commission.promoters[0]
          : commission.promoters;
        const profile = promoter
          ? Array.isArray(promoter.profiles)
            ? promoter.profiles[0]
            : promoter.profiles
          : null;
        if (!profile?.email) return;

        await sendCommissionEarnedEmail({
          toEmail: profile.email,
          toName: profile.full_name ?? null,
          commissionAmount: Number(commission.commission_amount),
          tradeAmount: parseFloat(parsed.data.amount),
        });
      } catch {
        // non-blocking — email failure must never affect the response
      }
    })();
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
