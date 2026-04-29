import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBinanceSpotPrice } from "@/lib/services/binance-price";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { insertInitialMarketPrice } from "@/lib/services/market-initial-prices";

type ShortDurationMarketRow = {
  id: string;
  title: string;
  title_zh: string | null;
  slug: string;
  description: string | null;
  description_zh: string | null;
  category: string | null;
  asset_symbol: string;
  question_text: string;
  question_text_zh: string | null;
  rules_text: string | null;
  rules_text_zh: string | null;
  status: string;
  close_at: string;
  duration_minutes: number | null;
  target_direction: string | null;
  spot_price_at_open: string | number | null;
  created_by: string;
};

export type ShortDurationSettlementResult =
  | {
      success: true;
      already?: boolean;
      outcome?: "yes" | "no";
      finalPrice?: number;
      spotAtOpen?: number;
      rolloverCreated?: boolean;
      nextMarketId?: string;
      nextMarketSlug?: string;
      nextMarketCloseAt?: string;
      rolloverError?: string;
      rolloverPriceError?: string;
    }
  | {
      success: false;
      status: number;
      message: string;
    };

export type ShortDurationSweepResult = {
  marketId: string;
  slug: string;
  result: ShortDurationSettlementResult;
};

function getSystemAdminProfileId(): string {
  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;
  if (!systemAdminId) {
    throw new Error("SYSTEM_ADMIN_PROFILE_ID is not set.");
  }
  return systemAdminId;
}

function deriveBaseSlug(slug: string): string {
  return slug.replace(/-\d{14}$/, "");
}

function buildArchivedRoundSlug(baseSlug: string, roundCloseAt: Date): string {
  const stamp = roundCloseAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${baseSlug}-${stamp}`.toLowerCase();
}

async function archiveSettledShortDurationMarket(
  market: ShortDurationMarketRow,
): Promise<{ archivedSlug: string | null; error?: string }> {
  const baseSlug = deriveBaseSlug(market.slug);

  if (market.slug !== baseSlug) {
    return { archivedSlug: market.slug };
  }

  const supabase = createSupabaseAdminClient();
  const roundCloseAt = new Date(market.close_at);
  const archivedSlug = buildArchivedRoundSlug(baseSlug, roundCloseAt);

  const { error } = await supabase
    .from("markets")
    .update({ slug: archivedSlug })
    .eq("id", market.id)
    .eq("slug", market.slug);

  if (!error) {
    return { archivedSlug };
  }

  const fallbackArchivedSlug = `${archivedSlug}-${market.id.slice(0, 8)}`.toLowerCase();
  const fallbackUpdate = await supabase
    .from("markets")
    .update({ slug: fallbackArchivedSlug })
    .eq("id", market.id)
    .eq("slug", market.slug);

  if (fallbackUpdate.error) {
    return {
      archivedSlug: null,
      error: fallbackUpdate.error.message ?? "Failed to archive settled short-duration market slug.",
    };
  }

  return { archivedSlug: fallbackArchivedSlug };
}

async function createNextShortDurationRound(
  market: ShortDurationMarketRow,
  binanceSymbol: string,
): Promise<ShortDurationSettlementResult> {
  const supabase = createSupabaseAdminClient();
  const baseSlug = deriveBaseSlug(market.slug);

  const durationMs = market.duration_minutes! * 60_000;
  const currentCloseAtMs = new Date(market.close_at).getTime();
  const nowMs = Date.now();
  const missedIntervals = Math.max(1, Math.floor((nowMs - currentCloseAtMs) / durationMs) + 1);
  const nextCloseAt = new Date(currentCloseAtMs + missedIntervals * durationMs);
  const nextSlug = baseSlug;

  let nextSpotPriceAtOpen: number;
  try {
    nextSpotPriceAtOpen = await getBinanceSpotPrice(binanceSymbol);
  } catch (err) {
    return {
      success: true,
      rolloverCreated: false,
      rolloverError:
        err instanceof Error
          ? err.message
          : "Failed to fetch next round opening price from Binance.",
    };
  }

  const { data: nextMarket, error: nextMarketErr } = await supabase
    .from("markets")
    .insert({
      title: market.title,
      title_zh: market.title_zh ?? null,
      slug: nextSlug,
      description: market.description ?? null,
      description_zh: market.description_zh ?? null,
      category: market.category ?? null,
      asset_symbol: market.asset_symbol,
      question_text: market.question_text,
      question_text_zh: market.question_text_zh ?? null,
      rules_text: market.rules_text ?? null,
      rules_text_zh: market.rules_text_zh ?? null,
      close_at: nextCloseAt.toISOString(),
      settle_at: nextCloseAt.toISOString(),
      status: "active",
      created_by: market.created_by,
      resolution_outcome: "unresolved",
      duration_minutes: market.duration_minutes,
      target_direction: null,
      spot_price_at_open: nextSpotPriceAtOpen,
    })
    .select("id, slug, close_at")
    .single();

  if (nextMarketErr) {
    if (nextMarketErr.code === "23505") {
      const existing = await supabase
        .from("markets")
        .select("id, slug, close_at")
        .eq("slug", nextSlug)
        .maybeSingle();

      if (existing.data) {
        return {
          success: true,
          rolloverCreated: true,
          nextMarketId: existing.data.id,
          nextMarketSlug: existing.data.slug,
          nextMarketCloseAt: existing.data.close_at,
        };
      }
    }

    return {
      success: true,
      rolloverCreated: false,
      rolloverError: nextMarketErr.message ?? "Failed to create next round.",
    };
  }

  try {
    await insertInitialMarketPrice(nextMarket.id, "short_duration_rollover");
  } catch (err) {
    return {
      success: true,
      rolloverCreated: true,
      nextMarketId: nextMarket.id,
      nextMarketSlug: nextMarket.slug,
      nextMarketCloseAt: nextMarket.close_at,
      rolloverPriceError:
        err instanceof Error ? err.message : "Failed to create next round initial price.",
    };
  }

  return {
    success: true,
    rolloverCreated: true,
    nextMarketId: nextMarket.id,
    nextMarketSlug: nextMarket.slug,
    nextMarketCloseAt: nextMarket.close_at,
  };
}

export async function settleShortDurationMarketById(
  marketId: string,
): Promise<ShortDurationSettlementResult> {
  const supabase = createSupabaseAdminClient();
  const systemAdminId = getSystemAdminProfileId();

  const { data: rawMarket, error: fetchErr } = await supabase
    .from("markets")
    .select(`
      id,
      title,
      title_zh,
      slug,
      description,
      description_zh,
      category,
      asset_symbol,
      question_text,
      question_text_zh,
      rules_text,
      rules_text_zh,
      status,
      close_at,
      duration_minutes,
      target_direction,
      spot_price_at_open,
      created_by
    `)
    .eq("id", marketId)
    .maybeSingle();

  const market = rawMarket as ShortDurationMarketRow | null;

  if (fetchErr || !market) {
    return { success: false, status: 404, message: "Market not found." };
  }

  if (market.duration_minutes == null) {
    return { success: false, status: 400, message: "Not a short-duration market." };
  }

  if (new Date(market.close_at) > new Date()) {
    return { success: false, status: 400, message: "Market window has not expired yet." };
  }

  if (market.status !== "active") {
    return { success: true, already: true };
  }

  const binanceSymbol = ASSET_TO_BINANCE[market.asset_symbol];
  if (!binanceSymbol) {
    return {
      success: false,
      status: 400,
      message: `No Binance symbol for asset ${market.asset_symbol}.`,
    };
  }

  let finalPrice: number;
  try {
    finalPrice = await getBinanceSpotPrice(binanceSymbol);
  } catch (err) {
    return {
      success: false,
      status: 502,
      message: err instanceof Error ? err.message : "Failed to fetch final price from Binance.",
    };
  }

  const spotAtOpen = parseFloat(String(market.spot_price_at_open ?? "0"));
  const outcome: "yes" | "no" = finalPrice >= spotAtOpen ? "yes" : "no";

  const { error: rpcErr } = await supabase.rpc("settle_market", {
    p_market_id: marketId,
    p_resolution: outcome,
    p_admin_profile_id: systemAdminId,
    p_notes: `Auto-settled: final price $${finalPrice.toFixed(2)}, opened at $${spotAtOpen.toFixed(2)}. Resolved ${outcome === "yes" ? "UP" : "DOWN"}.`,
  });

  if (rpcErr) {
    if (rpcErr.message?.includes("already finalized") || rpcErr.message?.includes("already settled")) {
      return { success: true, already: true };
    }

    return {
      success: false,
      status: 500,
      message: rpcErr.message ?? "Settlement failed.",
    };
  }

  const archiveResult = await archiveSettledShortDurationMarket(market);
  if (archiveResult.error) {
    return {
      success: true,
      outcome,
      finalPrice,
      spotAtOpen,
      rolloverCreated: false,
      rolloverError: archiveResult.error,
    };
  }

  const rollover = await createNextShortDurationRound(market, binanceSymbol);

  return {
    success: true,
    outcome,
    finalPrice,
    spotAtOpen,
    rolloverCreated: rollover.success ? rollover.rolloverCreated : false,
    nextMarketId: rollover.success ? rollover.nextMarketId : undefined,
    nextMarketSlug: rollover.success ? rollover.nextMarketSlug : undefined,
    nextMarketCloseAt: rollover.success ? rollover.nextMarketCloseAt : undefined,
    rolloverError: rollover.success ? rollover.rolloverError : undefined,
    rolloverPriceError: rollover.success ? rollover.rolloverPriceError : undefined,
  };
}

export async function settleExpiredShortDurationMarkets(
  limit = 25,
): Promise<ShortDurationSweepResult[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("markets")
    .select("id, slug")
    .eq("status", "active")
    .not("duration_minutes", "is", null)
    .lte("close_at", new Date().toISOString())
    .order("close_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch expired short-duration markets: ${error.message}`);
  }

  const results: ShortDurationSweepResult[] = [];

  for (const market of data ?? []) {
    const result = await settleShortDurationMarketById(market.id as string);
    results.push({
      marketId: market.id as string,
      slug: market.slug as string,
      result,
    });
  }

  return results;
}
