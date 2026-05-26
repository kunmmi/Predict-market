import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBinanceSpotPrice, getBinanceMinuteOpenPrice } from "@/lib/services/binance-price";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { insertInitialMarketPrice, DEFAULT_INITIAL_YES_PRICE } from "@/lib/services/market-initial-prices";
import { shortDurationTitle, shortDurationTitleZh, SHORT_DURATION_CUTOFF_SECONDS } from "@/lib/short-duration-predictions";
import { seedMarketMakerOrders } from "@/lib/services/market-maker";

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
      outcome?: "yes" | "no" | "cancelled";
      finalPrice?: number;
      spotAtOpen?: number;
      roundResult?: "up" | "down" | "flat";
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

async function findActiveShortDurationRound(baseSlug: string, excludeMarketId?: string): Promise<{
  id: string;
  slug: string;
  close_at: string;
} | null> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("markets")
    .select("id, slug, close_at")
    .eq("slug", baseSlug)
    .eq("status", "active")
    .not("duration_minutes", "is", null)
    .order("close_at", { ascending: false })
    .limit(1);

  if (excludeMarketId) {
    query = query.neq("id", excludeMarketId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return data;
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
  const now = Date.now();

  // The next round closes exactly `durationMs` after the previous round.
  // Anchoring to `market.close_at` (not `now`) prevents drift when the cron
  // runs late — e.g. previous round closed at 12:05:00 → next round always
  // closes at 12:10:00, regardless of whether we're processing this at
  // 12:05:30 or 12:08:00.
  const previousCloseMs = new Date(market.close_at).getTime();
  let nextCloseAt = new Date(previousCloseMs + durationMs);

  // If the cron was severely delayed (more than one round's worth) and the
  // target time is already in the past or too close to the present to give
  // traders meaningful entry time (< 30 s), skip forward in `durationMs`
  // steps until we land on a future, clock-aligned slot.
  while (nextCloseAt.getTime() - now < 30_000) {
    nextCloseAt = new Date(nextCloseAt.getTime() + durationMs);
  }
  const nextSlug = baseSlug;

  let nextSpotPriceAtOpen: number;
  let rolloverPriceError: string | undefined;
  try {
    // Use the price at the EXACT moment the new round starts.
    // For contiguous rounds: newRoundStartMs == previousCloseMs (same as before).
    // For skipped rounds (e.g. first market of the day): nextCloseAt has been
    // fast-forwarded past the gap, so newRoundStartMs resolves to approximately
    // "now", fetching today's live price instead of a stale historical one.
    const newRoundStartMs = nextCloseAt.getTime() - durationMs;
    nextSpotPriceAtOpen = await getBinanceMinuteOpenPrice(binanceSymbol, newRoundStartMs);
  } catch (err) {
    // Binance unavailable — fall back to the settled round's opening price so
    // the new round still gets created rather than leaving a gap at the base slug.
    const fallback = market.spot_price_at_open != null ? parseFloat(String(market.spot_price_at_open)) : null;
    if (!fallback || isNaN(fallback) || fallback <= 0) {
      return {
        success: true,
        rolloverCreated: false,
        rolloverError: err instanceof Error ? err.message : "Failed to fetch next round opening price from Binance.",
      };
    }
    nextSpotPriceAtOpen = fallback;
    rolloverPriceError = err instanceof Error ? err.message : "Used fallback opening price (Binance unavailable).";
  }

  const { data: nextMarket, error: nextMarketErr } = await supabase
    .from("markets")
    .insert({
      title: shortDurationTitle(market.asset_symbol, market.duration_minutes!),
      title_zh: shortDurationTitleZh(market.asset_symbol, market.duration_minutes!),
      slug: nextSlug,
      description: market.description ?? null,
      description_zh: market.description_zh ?? null,
      category: market.category ?? null,
      asset_symbol: market.asset_symbol,
      question_text: shortDurationTitle(market.asset_symbol, market.duration_minutes!),
      question_text_zh: shortDurationTitleZh(market.asset_symbol, market.duration_minutes!),
      rules_text: market.rules_text ?? null,
      rules_text_zh: market.rules_text_zh ?? null,
      close_at: nextCloseAt.toISOString(),
      settle_at: nextCloseAt.toISOString(),
      cutoff_at: new Date(nextCloseAt.getTime() - SHORT_DURATION_CUTOFF_SECONDS * 1_000).toISOString(),
      status: "active",
      created_by: market.created_by,
      resolution_outcome: "unresolved",
      duration_minutes: market.duration_minutes,
      target_direction: null,
      spot_price_at_open: nextSpotPriceAtOpen,
      final_spot_price: null,
      round_result: null,
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

  // Seed house market-maker orders. Non-blocking — a failure here must never
  // prevent the round from starting.
  // Pass the initial YES probability (0.5) — NOT the BTC spot price — since
  // seedMarketMakerOrders expects a 0–1 probability, not a dollar value.
  void seedMarketMakerOrders(nextMarket.id, DEFAULT_INITIAL_YES_PRICE).catch(() => undefined);

  return {
    success: true,
    rolloverCreated: true,
    nextMarketId: nextMarket.id,
    nextMarketSlug: nextMarket.slug,
    nextMarketCloseAt: nextMarket.close_at,
    rolloverPriceError,
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

  const baseSlug = deriveBaseSlug(market.slug);

  if (new Date(market.close_at) > new Date()) {
    return { success: false, status: 400, message: "Market window has not expired yet." };
  }

  if (market.status !== "active") {
    const activeRound = await findActiveShortDurationRound(baseSlug, market.id);

    return {
      success: true,
      already: true,
      rolloverCreated: Boolean(activeRound),
      nextMarketId: activeRound?.id,
      nextMarketSlug: activeRound?.slug,
      nextMarketCloseAt: activeRound?.close_at,
    };
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
    // Capture the price at the EXACT round-close minute boundary, so the
    // recorded final price matches what Binance's chart shows at that time
    // — not the (possibly later) moment the cron actually ran.
    const closeAtMs = new Date(market.close_at).getTime();
    finalPrice = await getBinanceMinuteOpenPrice(binanceSymbol, closeAtMs);
  } catch (err) {
    return {
      success: false,
      status: 502,
      message: err instanceof Error ? err.message : "Failed to fetch final price from Binance.",
    };
  }

  const spotAtOpen = parseFloat(String(market.spot_price_at_open ?? "0"));
  const roundResult: "up" | "down" | "flat" =
    finalPrice > spotAtOpen ? "up" : finalPrice < spotAtOpen ? "down" : "flat";
  const outcome: "yes" | "no" | "cancelled" =
    roundResult === "up" ? "yes" : roundResult === "down" ? "no" : "cancelled";

  const { error: snapshotErr } = await supabase
    .from("markets")
    .update({
      final_spot_price: finalPrice,
      round_result: roundResult,
    })
    .eq("id", marketId)
    .eq("status", "active");

  if (snapshotErr) {
    return {
      success: false,
      status: 500,
      message: snapshotErr.message ?? "Failed to snapshot final round price.",
    };
  }

  const { error: rpcErr } = await supabase.rpc("settle_market", {
    p_market_id: marketId,
    p_resolution: outcome,
    p_admin_profile_id: systemAdminId,
    p_notes: `Auto-settled: final price $${finalPrice.toFixed(2)}, opened at $${spotAtOpen.toFixed(2)}. Round result ${roundResult.toUpperCase()}.`,
  });

  if (rpcErr) {
    if (rpcErr.message?.includes("already finalized") || rpcErr.message?.includes("already settled")) {
      const activeRound = await findActiveShortDurationRound(baseSlug, market.id);

      return {
        success: true,
        already: true,
        rolloverCreated: Boolean(activeRound),
        nextMarketId: activeRound?.id,
        nextMarketSlug: activeRound?.slug,
        nextMarketCloseAt: activeRound?.close_at,
      };
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
      roundResult,
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
    roundResult,
    rolloverCreated: rollover.success ? rollover.rolloverCreated : false,
    nextMarketId: rollover.success ? rollover.nextMarketId : undefined,
    nextMarketSlug: rollover.success ? rollover.nextMarketSlug : undefined,
    nextMarketCloseAt: rollover.success ? rollover.nextMarketCloseAt : undefined,
    rolloverError: rollover.success ? rollover.rolloverError : undefined,
    rolloverPriceError: rollover.success ? rollover.rolloverPriceError : undefined,
  };
}

/**
 * Ensures a short-duration market's spot_price_at_open matches the actual
 * Binance minute-open price for the round's start time. Silently repairs stale
 * values in the DB and returns the authoritative opening price.
 *
 * Call this on every active short-duration market page load — it's idempotent
 * and fast (single Binance kline request, skipped entirely if price is fresh).
 */
export async function ensureRoundOpeningPrice(market: {
  id: string;
  assetSymbol: string;
  closeAt: string;
  durationMinutes: number;
  spotPriceAtOpen: string | null;
}): Promise<number | null> {
  const binanceSymbol = ASSET_TO_BINANCE[market.assetSymbol];
  if (!binanceSymbol) return market.spotPriceAtOpen != null ? Number(market.spotPriceAtOpen) : null;

  const roundStartMs =
    new Date(market.closeAt).getTime() - market.durationMinutes * 60_000;

  let freshPrice: number;
  try {
    freshPrice = await getBinanceMinuteOpenPrice(binanceSymbol, roundStartMs);
  } catch {
    // Binance unreachable — trust whatever is in the DB.
    return market.spotPriceAtOpen != null ? Number(market.spotPriceAtOpen) : null;
  }

  const storedPrice = market.spotPriceAtOpen != null ? Number(market.spotPriceAtOpen) : null;

  // If stored price is within 0.05% of fresh, it's fine — avoid noisy DB writes.
  if (
    storedPrice != null &&
    Math.abs(storedPrice - freshPrice) / freshPrice < 0.0005
  ) {
    return storedPrice;
  }

  // Price is missing or stale — update silently.
  try {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from("markets")
      .update({ spot_price_at_open: freshPrice })
      .eq("id", market.id)
      .eq("status", "active");
  } catch {
    // Non-critical — return the fresh price anyway so this render is correct.
  }

  return freshPrice;
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
