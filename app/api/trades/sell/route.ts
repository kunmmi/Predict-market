import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { updatePriceAfterTrade } from "@/lib/services/dynamic-pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { tradeSellSchema } from "@/lib/validations/trade";

type PositionRow = {
  id: string;
  profile_id: string;
  market_id: string;
  yes_units: string | number;
  no_units: string | number;
  status: "open" | "settled" | "cancelled";
  avg_yes_price: string | number | null;
  avg_no_price: string | number | null;
  markets:
    | {
        status: "draft" | "active" | "closed" | "settled" | "cancelled";
        close_at: string;
      }
    | null;
};

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

  if (!rateLimit(`trades:sell:${profileId}`, 10, 60_000)) {
    return rateLimitResponse("Too many sell requests. Please wait before trying again.");
  }

  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json(
      { success: false, message: "Malformed JSON body." },
      { status: 400 },
    );
  }

  const parsed = tradeSellSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const unitsToSell = Number.parseFloat(parsed.data.units);
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: positionData, error: positionError } = await supabaseAdmin
    .from("positions")
    .select(
      `id, profile_id, market_id, yes_units, no_units, status, avg_yes_price, avg_no_price,
       markets ( status, close_at )`,
    )
    .eq("id", parsed.data.position_id)
    .maybeSingle();

  if (positionError || !positionData) {
    return NextResponse.json(
      { success: false, message: "Position not found." },
      { status: 404 },
    );
  }

  const position = positionData as unknown as PositionRow;

  if (position.profile_id !== profileId) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  if (position.status !== "open") {
    return NextResponse.json(
      { success: false, message: "Only open positions can be sold." },
      { status: 400 },
    );
  }

  if (!position.markets || position.markets.status !== "active") {
    return NextResponse.json(
      { success: false, message: "This market is no longer tradeable." },
      { status: 400 },
    );
  }

  if (new Date(position.markets.close_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { success: false, message: "This market is closed for selling." },
      { status: 400 },
    );
  }

  const currentUnits = parsed.data.side === "yes" ? Number(position.yes_units) : Number(position.no_units);
  if (unitsToSell > currentUnits) {
    return NextResponse.json(
      { success: false, message: "You cannot sell more units than you currently hold." },
      { status: 400 },
    );
  }

  const { data: latestPrice, error: latestPriceError } = await supabaseAdmin
    .from("market_prices")
    .select("yes_price, no_price")
    .eq("market_id", position.market_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestPriceError || !latestPrice) {
    return NextResponse.json(
      { success: false, message: "Current market price is unavailable." },
      { status: 400 },
    );
  }

  const sidePrice = parsed.data.side === "yes" ? Number(latestPrice.yes_price) : Number(latestPrice.no_price);
  const payout = Number((unitsToSell * sidePrice).toFixed(8));

  const nextYesUnits =
    parsed.data.side === "yes"
      ? Number((Number(position.yes_units) - unitsToSell).toFixed(8))
      : Number(position.yes_units);
  const nextNoUnits =
    parsed.data.side === "no"
      ? Number((Number(position.no_units) - unitsToSell).toFixed(8))
      : Number(position.no_units);

  const { error: updateError } = await supabaseAdmin
    .from("positions")
    .update({
      yes_units: nextYesUnits,
      no_units: nextNoUnits,
      avg_yes_price: nextYesUnits > 0 ? position.avg_yes_price : null,
      avg_no_price: nextNoUnits > 0 ? position.avg_no_price : null,
      status: "open",
    })
    .eq("id", position.id)
    .eq("profile_id", profileId);

  if (updateError) {
    return NextResponse.json(
      { success: false, message: "Failed to update the position." },
      { status: 500 },
    );
  }

  const { data: trade, error: tradeError } = await supabaseAdmin
    .from("trades")
    .insert({
      profile_id: profileId,
      market_id: position.market_id,
      side: parsed.data.side,
      amount: payout,
      price: sidePrice,
      fee_amount: 0,
      position_units: unitsToSell,
      status: "executed",
    })
    .select("id")
    .single();

  if (tradeError || !trade) {
    return NextResponse.json(
      { success: false, message: "Failed to record the sell trade." },
      { status: 500 },
    );
  }

  const { error: creditError } = await supabaseAdmin.rpc("credit_wallet", {
    p_profile_id: profileId,
    p_amount: payout,
    p_transaction_type: "trade_credit",
    p_reference_table: "trades",
    p_reference_id: trade.id,
    p_asset_symbol: "USD",
    p_description: `Sell ${parsed.data.side.toUpperCase()} position`,
  });

  if (creditError) {
    return NextResponse.json(
      { success: false, message: creditError.message ?? "Failed to credit wallet." },
      { status: 500 },
    );
  }

  void updatePriceAfterTrade(position.market_id);

  return NextResponse.json({ success: true, payout }, { status: 200 });
}
