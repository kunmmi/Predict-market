import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { updatePriceAfterTrade } from "@/lib/services/dynamic-pricing";
import { getBinanceSpotPrice } from "@/lib/services/binance-price";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeBinaryYesPrice } from "@/lib/short-duration-predictions";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { OVERROUND, SELL_FEE_RATE } from "@/lib/config/trading-constants";
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
        duration_minutes: number | null;
        asset_symbol: string;
        spot_price_at_open: string | number | null;
        market_prices: { yes_price: string | number; no_price: string | number }[];
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

  if (!await rateLimit(`trades:sell:${profileId}`, 10, 60_000)) {
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
       markets (
         status, close_at, duration_minutes, asset_symbol, spot_price_at_open,
         market_prices ( yes_price, no_price )
       )`,
    )
    .eq("id", parsed.data.position_id)
    .order("created_at", { referencedTable: "markets.market_prices", ascending: false })
    .limit(1, { referencedTable: "markets.market_prices" })
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

  const closeAt = new Date(position.markets.close_at);
  if (closeAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { success: false, message: "This market is closed for selling." },
      { status: 400 },
    );
  }

  const currentUnits =
    parsed.data.side === "yes" ? Number(position.yes_units) : Number(position.no_units);
  if (unitsToSell > currentUnits) {
    return NextResponse.json(
      { success: false, message: "You cannot sell more units than you currently hold." },
      { status: 400 },
    );
  }

  // ── Price resolution ───────────────────────────────────────────────────────
  // For short-duration markets: compute live Black-Scholes price from Binance
  // so the sell price matches what the user sees on screen exactly.
  // For regular markets: fall back to the latest stored market_prices entry.
  let sidePrice: number;

  const isShortDuration = position.markets.duration_minutes != null;
  if (isShortDuration) {
    const binanceSymbol = ASSET_TO_BINANCE[position.markets.asset_symbol] ?? null;
    const spotPriceAtOpen = position.markets.spot_price_at_open != null
      ? Number(position.markets.spot_price_at_open)
      : null;

    if (binanceSymbol && spotPriceAtOpen != null) {
      try {
        const liveSpot = await getBinanceSpotPrice(binanceSymbol);
        const secondsRemaining = Math.max(
          0,
          Math.floor((closeAt.getTime() - Date.now()) / 1_000),
        );
        const fairYes = computeBinaryYesPrice({
          currentSpotPrice: liveSpot,
          openingSpotPrice: spotPriceAtOpen,
          secondsRemaining,
          recentCandles: [],
        });
        const liveYes = Math.max(0.01, Math.min(0.99, fairYes * (1 + OVERROUND)));
        const fairYesUnrounded = liveYes / (1 + OVERROUND);
        const liveNo  = Math.max(0.01, Math.min(0.99, (1 - fairYesUnrounded) * (1 + OVERROUND)));
        sidePrice = parsed.data.side === "yes" ? liveYes : liveNo;
      } catch {
        // Binance unavailable — fall back to DB price
        sidePrice = getFallbackPrice(position, parsed.data.side);
      }
    } else {
      sidePrice = getFallbackPrice(position, parsed.data.side);
    }
  } else {
    sidePrice = getFallbackPrice(position, parsed.data.side);
  }

  const grossPayout = Number((unitsToSell * sidePrice).toFixed(8));
  const sellFee     = Number((grossPayout * SELL_FEE_RATE).toFixed(8));
  const payout      = Number((grossPayout - sellFee).toFixed(8));

  // ── Update position ────────────────────────────────────────────────────────
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
      fee_amount: sellFee,
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

function getFallbackPrice(position: PositionRow, side: "yes" | "no"): number {
  const latest = position.markets?.market_prices?.[0];
  if (!latest) return 0.5;
  return side === "yes" ? Number(latest.yes_price) : Number(latest.no_price);
}
