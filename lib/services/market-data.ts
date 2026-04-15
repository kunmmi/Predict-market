import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MarketStatus, MarketOutcome, MarketAssetSymbol } from "@/types/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketListItem = {
  id: string;
  title: string;
  titleZh: string | null;
  slug: string;
  assetSymbol: MarketAssetSymbol;
  status: MarketStatus;
  yesPrice: string | null;
  noPrice: string | null;
  closeAt: string;
  settleAt: string;
  createdAt: string;
};

export type MarketDetail = {
  id: string;
  title: string;
  titleZh: string | null;
  slug: string;
  description: string | null;
  descriptionZh: string | null;
  category: string | null;
  assetSymbol: MarketAssetSymbol;
  questionText: string;
  questionTextZh: string | null;
  rulesText: string | null;
  rulesTextZh: string | null;
  closeAt: string;
  settleAt: string;
  status: MarketStatus;
  resolutionOutcome: MarketOutcome;
  resolutionNotes: string | null;
  createdBy: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestYesPrice: string | null;
  latestNoPrice: string | null;
};

export type AdminMarketRow = {
  id: string;
  title: string;
  slug: string;
  assetSymbol: MarketAssetSymbol;
  status: MarketStatus;
  resolutionOutcome: MarketOutcome;
  closeAt: string;
  settleAt: string;
  createdAt: string;
  updatedAt: string;
  latestYesPrice: string | null;
  latestNoPrice: string | null;
};

// ---------------------------------------------------------------------------
// Raw DB row helper type
// ---------------------------------------------------------------------------

type RawMarketRow = {
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
  close_at: string;
  settle_at: string;
  status: string;
  resolution_outcome: string;
  resolution_notes: string | null;
  created_by: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  market_prices?: Array<{ yes_price: string | number; no_price: string | number; created_at: string }> | null;
};

function toPrice(v: string | number | null | undefined): string | null {
  if (v == null) return null;
  return String(v);
}

// ---------------------------------------------------------------------------
// Public / user queries (uses server client — respects RLS)
// ---------------------------------------------------------------------------

/**
 * Returns active markets visible to all authenticated users.
 */
export async function getActiveMarkets(): Promise<MarketListItem[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("markets")
    .select(
      `id, title, title_zh, slug, asset_symbol, status, close_at, settle_at, created_at,
       market_prices ( yes_price, no_price, created_at )`,
    )
    .eq("status", "active")
    .order("close_at", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as RawMarketRow[]).map((row) => {
    const prices = Array.isArray(row.market_prices) ? row.market_prices : [];
    const latest = prices.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0] ?? null;
    return {
      id: row.id,
      title: row.title,
      titleZh: row.title_zh ?? null,
      slug: row.slug,
      assetSymbol: row.asset_symbol as MarketAssetSymbol,
      status: row.status as MarketStatus,
      yesPrice: toPrice(latest?.yes_price),
      noPrice: toPrice(latest?.no_price),
      closeAt: row.close_at,
      settleAt: row.settle_at,
      createdAt: row.created_at,
    };
  });
}

/**
 * Returns a single market by slug (public RLS — active is visible to all).
 */
export async function getMarketBySlug(slug: string): Promise<MarketDetail | null> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("markets")
    .select(
      `id, title, title_zh, slug, description, description_zh, category,
       asset_symbol, question_text, question_text_zh, rules_text, rules_text_zh,
       close_at, settle_at, status, resolution_outcome, resolution_notes,
       created_by, resolved_by, resolved_at, created_at, updated_at,
       market_prices ( yes_price, no_price, created_at )`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as RawMarketRow;
  const prices = Array.isArray(row.market_prices) ? row.market_prices : [];
  const latest = prices.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0] ?? null;

  return {
    id: row.id,
    title: row.title,
    titleZh: row.title_zh ?? null,
    slug: row.slug,
    description: row.description,
    descriptionZh: row.description_zh ?? null,
    category: row.category,
    assetSymbol: row.asset_symbol as MarketAssetSymbol,
    questionText: row.question_text,
    questionTextZh: row.question_text_zh ?? null,
    rulesText: row.rules_text,
    rulesTextZh: row.rules_text_zh ?? null,
    closeAt: row.close_at,
    settleAt: row.settle_at,
    status: row.status as MarketStatus,
    resolutionOutcome: row.resolution_outcome as MarketOutcome,
    resolutionNotes: row.resolution_notes,
    createdBy: row.created_by,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestYesPrice: toPrice(latest?.yes_price),
    latestNoPrice: toPrice(latest?.no_price),
  };
}

/**
 * Returns active markets for the public landing page.
 * Uses the admin client so it works without an authenticated session.
 */
export async function getPublicActiveMarkets(): Promise<MarketListItem[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("markets")
    .select(
      `id, title, title_zh, slug, asset_symbol, status, close_at, settle_at, created_at,
       market_prices ( yes_price, no_price, created_at )`,
    )
    .eq("status", "active")
    .order("close_at", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as RawMarketRow[]).map((row) => {
    const prices = Array.isArray(row.market_prices) ? row.market_prices : [];
    const latest = prices.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0] ?? null;
    return {
      id: row.id,
      title: row.title,
      titleZh: row.title_zh ?? null,
      slug: row.slug,
      assetSymbol: row.asset_symbol as MarketAssetSymbol,
      status: row.status as MarketStatus,
      yesPrice: toPrice(latest?.yes_price),
      noPrice: toPrice(latest?.no_price),
      closeAt: row.close_at,
      settleAt: row.settle_at,
      createdAt: row.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Admin queries (uses admin client — bypasses RLS)
// ---------------------------------------------------------------------------

export async function getAllMarketsAdmin(): Promise<AdminMarketRow[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("markets")
    .select(
      `id, title, slug, asset_symbol, status, resolution_outcome, close_at, settle_at, created_at, updated_at,
       market_prices ( yes_price, no_price, created_at )`,
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as RawMarketRow[]).map((row) => {
    const prices = Array.isArray(row.market_prices) ? row.market_prices : [];
    const latest = prices.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0] ?? null;
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      assetSymbol: row.asset_symbol as MarketAssetSymbol,
      status: row.status as MarketStatus,
      resolutionOutcome: row.resolution_outcome as MarketOutcome,
      closeAt: row.close_at,
      settleAt: row.settle_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      latestYesPrice: toPrice(latest?.yes_price),
      latestNoPrice: toPrice(latest?.no_price),
    };
  });
}

/**
 * Get a single market by ID for admin use.
 */
export async function getMarketByIdAdmin(id: string): Promise<MarketDetail | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("markets")
    .select(
      `id, title, title_zh, slug, description, description_zh, category,
       asset_symbol, question_text, question_text_zh, rules_text, rules_text_zh,
       close_at, settle_at, status, resolution_outcome, resolution_notes,
       created_by, resolved_by, resolved_at, created_at, updated_at,
       market_prices ( yes_price, no_price, created_at )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as RawMarketRow;
  const prices = Array.isArray(row.market_prices) ? row.market_prices : [];
  const latest = prices.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0] ?? null;

  return {
    id: row.id,
    title: row.title,
    titleZh: row.title_zh ?? null,
    slug: row.slug,
    description: row.description,
    descriptionZh: row.description_zh ?? null,
    category: row.category,
    assetSymbol: row.asset_symbol as MarketAssetSymbol,
    questionText: row.question_text,
    questionTextZh: row.question_text_zh ?? null,
    rulesText: row.rules_text,
    rulesTextZh: row.rules_text_zh ?? null,
    closeAt: row.close_at,
    settleAt: row.settle_at,
    status: row.status as MarketStatus,
    resolutionOutcome: row.resolution_outcome as MarketOutcome,
    resolutionNotes: row.resolution_notes,
    createdBy: row.created_by,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestYesPrice: toPrice(latest?.yes_price),
    latestNoPrice: toPrice(latest?.no_price),
  };
}
