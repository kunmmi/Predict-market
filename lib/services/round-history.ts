/**
 * Round history and upcoming-round pre-creation for short-duration markets.
 *
 * Rounds use two slug formats:
 *  - Base slug  "btc-5min"              → the current live round
 *  - Archived   "btc-5min-20240528101500" → any settled or pre-created round
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  shortDurationTitle,
  shortDurationTitleZh,
  SHORT_DURATION_CUTOFF_SECONDS,
} from "@/lib/short-duration-predictions";
import { insertInitialMarketPrice, DEFAULT_INITIAL_YES_PRICE } from "@/lib/services/market-initial-prices";
import { seedMarketMakerOrders } from "@/lib/services/market-maker";

export type RoundPhase = "settled" | "live" | "upcoming";

export type RoundSlot = {
  id: string;
  slug: string;
  closeAt: string;
  /** ISO string of when the round opens (closeAt − durationMinutes) */
  openAt: string;
  roundResult: "up" | "down" | "flat" | null;
  phase: RoundPhase;
};

export type RoundHistory = {
  /** Up to 4 most-recent settled rounds, oldest → newest */
  past: RoundSlot[];
  /** The current live round, or null if none found */
  current: RoundSlot | null;
  /** Pre-created upcoming rounds, soonest first */
  upcoming: RoundSlot[];
};

function buildTimestampedSlug(baseSlug: string, closeAt: Date): string {
  const stamp = closeAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${baseSlug}-${stamp}`.toLowerCase();
}

function toSlot(
  row: { id: string; slug: string; close_at: string; round_result: string | null },
  durationMs: number,
  phase: RoundPhase,
): RoundSlot {
  return {
    id: row.id,
    slug: row.slug,
    closeAt: row.close_at,
    openAt: new Date(new Date(row.close_at).getTime() - durationMs).toISOString(),
    roundResult: (row.round_result ?? null) as RoundSlot["roundResult"],
    phase,
  };
}

/**
 * Fetches past, current, and pre-created upcoming rounds for a base slug.
 * Does NOT create any rounds — call ensureUpcomingRound separately if needed.
 */
export async function getRoundHistory(
  baseSlug: string,
  durationMinutes: number,
): Promise<RoundHistory> {
  const supabase = createSupabaseAdminClient();
  const durationMs = durationMinutes * 60_000;
  const now = new Date();

  const [currentRes, pastRes, upcomingRes] = await Promise.all([
    // Current round lives at the base slug
    supabase
      .from("markets")
      .select("id, slug, close_at, round_result")
      .eq("slug", baseSlug)
      .eq("status", "active")
      .not("duration_minutes", "is", null)
      .maybeSingle(),

    // Past rounds have timestamped slugs + settled status
    supabase
      .from("markets")
      .select("id, slug, close_at, round_result")
      .like("slug", `${baseSlug}-%`)
      .eq("status", "settled")
      .not("duration_minutes", "is", null)
      .order("close_at", { ascending: false })
      .limit(4),

    // Pre-created upcoming rounds: active, timestamped slug, close_at in future
    supabase
      .from("markets")
      .select("id, slug, close_at, round_result")
      .like("slug", `${baseSlug}-%`)
      .eq("status", "active")
      .gt("close_at", now.toISOString())
      .not("duration_minutes", "is", null)
      .order("close_at", { ascending: true })
      .limit(2),
  ]);

  const currentRow = currentRes.data ?? null;
  const current = currentRow
    ? toSlot(
        currentRow,
        durationMs,
        // If openAt is still in the future, the round hasn't started
        new Date(currentRow.close_at).getTime() - durationMs > now.getTime()
          ? "upcoming"
          : "live",
      )
    : null;

  // Reverse so we get oldest → newest for the bar display
  const past = [...(pastRes.data ?? [])]
    .reverse()
    .map((r) => toSlot(r, durationMs, "settled"));

  const upcoming = (upcomingRes.data ?? []).map((r) =>
    toSlot(r, durationMs, "upcoming"),
  );

  return { past, current, upcoming };
}

/**
 * Pre-creates the round immediately following `currentCloseAt` if it doesn't
 * already exist. Returns the created/found round, or null on failure.
 *
 * The new round is created with spot_price_at_open = null so the trade form
 * shows 50/50 prices. ensureRoundOpeningPrice will set the real price once
 * the round's start time arrives.
 */
export async function ensureUpcomingRound(params: {
  baseSlug: string;
  currentCloseAt: string;
  durationMinutes: number;
  assetSymbol: string;
  createdBy: string;
}): Promise<{ id: string; slug: string; closeAt: string } | null> {
  const { baseSlug, currentCloseAt, durationMinutes, assetSymbol, createdBy } = params;
  const supabase = createSupabaseAdminClient();

  const durationMs = durationMinutes * 60_000;
  const nextCloseAt = new Date(new Date(currentCloseAt).getTime() + durationMs);
  const nextSlug = buildTimestampedSlug(baseSlug, nextCloseAt);
  const cutoffAt = new Date(nextCloseAt.getTime() - SHORT_DURATION_CUTOFF_SECONDS * 1_000);

  // Return existing round if already created
  const { data: existing } = await supabase
    .from("markets")
    .select("id, slug, close_at")
    .eq("slug", nextSlug)
    .maybeSingle();

  if (existing) return { id: existing.id, slug: existing.slug, closeAt: existing.close_at };

  const { data: newMarket, error } = await supabase
    .from("markets")
    .insert({
      title: shortDurationTitle(assetSymbol, durationMinutes),
      title_zh: shortDurationTitleZh(assetSymbol, durationMinutes),
      slug: nextSlug,
      asset_symbol: assetSymbol,
      question_text: shortDurationTitle(assetSymbol, durationMinutes),
      question_text_zh: shortDurationTitleZh(assetSymbol, durationMinutes),
      close_at: nextCloseAt.toISOString(),
      settle_at: nextCloseAt.toISOString(),
      cutoff_at: cutoffAt.toISOString(),
      status: "active",
      created_by: createdBy,
      resolution_outcome: "unresolved",
      duration_minutes: durationMinutes,
      target_direction: null,
      spot_price_at_open: null, // set by ensureRoundOpeningPrice when round starts
      final_spot_price: null,
      round_result: null,
    })
    .select("id, slug, close_at")
    .single();

  if (error || !newMarket) return null;

  // Seed 50/50 initial prices + market-maker orders — non-blocking
  void insertInitialMarketPrice(newMarket.id, "upcoming_pre_created").catch(() => undefined);
  void seedMarketMakerOrders(newMarket.id, DEFAULT_INITIAL_YES_PRICE).catch(() => undefined);

  return { id: newMarket.id, slug: newMarket.slug, closeAt: newMarket.close_at };
}

/**
 * Called by the settlement cron: checks if a pre-created upcoming round
 * already exists for the next time slot, and if so promotes it to the base
 * slug so it becomes the new "current" round. Returns the promoted round, or
 * null if no pre-created round was found (caller should create one fresh).
 */
export async function promoteUpcomingRound(
  baseSlug: string,
  nextCloseAt: Date,
): Promise<{ id: string; slug: string } | null> {
  const supabase = createSupabaseAdminClient();
  const expectedSlug = buildTimestampedSlug(baseSlug, nextCloseAt);

  const { data } = await supabase
    .from("markets")
    .select("id, slug")
    .eq("slug", expectedSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return null;

  const { error } = await supabase
    .from("markets")
    .update({ slug: baseSlug })
    .eq("id", data.id);

  if (error) return null;
  return { id: data.id, slug: baseSlug };
}
