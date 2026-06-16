import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const FEE_RATE = 0.05; // 5% platform fee on stake

const schema = z.object({
  market_id:  z.string().uuid(),
  outcome_id: z.string().uuid(),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Amount must be a positive decimal.")
    .refine((v) => parseFloat(v) >= 1,    "Minimum stake is $1.")
    .refine((v) => parseFloat(v) <= 500,  "Maximum stake is $500."),
});

/**
 * POST /api/trades/multi
 * Places a trade on a multi-outcome market.
 * Calls place_multi_trade RPC which atomically:
 *   - debits wallet (stake + fee)
 *   - creates/updates position with outcome_id
 *   - updates outcome pool_amount + recalculates all prices
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

  if (!rateLimit(`trades:${profileId}`, 10, 60_000)) {
    return rateLimitResponse("Too many trades. Please wait.");
  }

  const body = await request.json().catch(() => undefined);
  if (!body) {
    return NextResponse.json({ success: false, message: "Malformed request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.errors[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { market_id, outcome_id, amount } = parsed.data;
  const stakeAmount = parseFloat(amount);
  const feeAmount   = parseFloat((stakeAmount * FEE_RATE).toFixed(6));

  const supabase = createSupabaseAdminClient();

  // Verify the market is multi-outcome and active before calling RPC
  const { data: market } = await supabase
    .from("markets")
    .select("status, market_type, close_at")
    .eq("id", market_id)
    .maybeSingle();

  if (!market) {
    return NextResponse.json({ success: false, message: "Market not found." }, { status: 404 });
  }
  if (market.market_type !== "multi") {
    return NextResponse.json(
      { success: false, message: "Use the standard trade endpoint for binary markets." },
      { status: 400 },
    );
  }
  if (market.status !== "active") {
    return NextResponse.json(
      { success: false, message: "This market is no longer accepting trades." },
      { status: 409 },
    );
  }
  if (new Date(market.close_at) <= new Date()) {
    return NextResponse.json(
      { success: false, message: "Trading is closed for this market." },
      { status: 409 },
    );
  }

  const { data: positionId, error } = await supabase.rpc("place_multi_trade", {
    p_profile_id:  profileId,
    p_market_id:   market_id,
    p_outcome_id:  outcome_id,
    p_amount:      stakeAmount,
    p_fee_amount:  feeAmount,
  });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message ?? "Trade failed." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, positionId }, { status: 201 });
}
