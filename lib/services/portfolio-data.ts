import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TradeSide, TradeStatus, PositionStatus } from "@/types/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PortfolioPosition = {
  id: string;
  marketId: string;
  marketTitle: string;
  marketTitleZh: string | null;
  marketSlug: string;
  marketStatus: string;
  yesUnits: string;
  noUnits: string;
  avgYesPrice: string | null;
  avgNoPrice: string | null;
  latestYesPrice: string | null;
  latestNoPrice: string | null;
  status: PositionStatus;
  pnlAmount: string;
  updatedAt: string;
};

export type PortfolioTrade = {
  id: string;
  marketId: string;
  marketTitle: string;
  marketTitleZh: string | null;
  marketSlug: string;
  side: TradeSide;
  amount: string;
  price: string;
  feeAmount: string;
  positionUnits: string;
  status: TradeStatus;
  createdAt: string;
};

export type PortfolioData = {
  openPositions: PortfolioPosition[];
  settledPositions: PortfolioPosition[];
  recentTrades: PortfolioTrade[];
};

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

type RawPosition = {
  id: string;
  market_id: string;
  yes_units: string | number;
  no_units: string | number;
  avg_yes_price: string | number | null;
  avg_no_price: string | number | null;
  status: PositionStatus;
  pnl_amount: string | number;
  updated_at: string;
  markets: {
    id: string;
    title: string;
    title_zh: string | null;
    slug: string;
    status: string;
    market_prices?: Array<{
      yes_price: string | number;
      no_price: string | number;
      created_at: string;
    }> | null;
  } | null;
};

type RawTrade = {
  id: string;
  market_id: string;
  side: TradeSide;
  amount: string | number;
  price: string | number;
  fee_amount: string | number;
  position_units: string | number;
  status: TradeStatus;
  created_at: string;
  markets: {
    title: string;
    title_zh: string | null;
    slug: string;
  } | null;
};

function latestPrice(
  prices: Array<{ yes_price: string | number; no_price: string | number; created_at: string }> | null | undefined,
): { yes: string | null; no: string | null } {
  if (!prices || prices.length === 0) return { yes: null, no: null };
  const sorted = [...prices].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return {
    yes: String(sorted[0].yes_price),
    no: String(sorted[0].no_price),
  };
}

export async function getPortfolioData(profileId: string): Promise<PortfolioData> {
  const supabase = createSupabaseServerClient();

  const [positionsRes, tradesRes] = await Promise.all([
    supabase
      .from("positions")
      .select(
        `id, market_id, yes_units, no_units, avg_yes_price, avg_no_price, status, pnl_amount, updated_at,
         markets (
           id, title, title_zh, slug, status,
           market_prices ( yes_price, no_price, created_at )
         )`,
      )
      .eq("profile_id", profileId)
      .order("updated_at", { ascending: false }),

    supabase
      .from("trades")
      .select(
        `id, market_id, side, amount, price, fee_amount, position_units, status, created_at,
         markets ( title, title_zh, slug )`,
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const positions = (positionsRes.data ?? []) as unknown as RawPosition[];
  const trades = (tradesRes.data ?? []) as unknown as RawTrade[];

  const mapPosition = (row: RawPosition): PortfolioPosition => {
    const prices = latestPrice(row.markets?.market_prices);
    return {
      id: row.id,
      marketId: row.market_id,
      marketTitle: row.markets?.title ?? "—",
      marketTitleZh: row.markets?.title_zh ?? null,
      marketSlug: row.markets?.slug ?? "",
      marketStatus: row.markets?.status ?? "unknown",
      yesUnits: String(row.yes_units),
      noUnits: String(row.no_units),
      avgYesPrice: row.avg_yes_price != null ? String(row.avg_yes_price) : null,
      avgNoPrice: row.avg_no_price != null ? String(row.avg_no_price) : null,
      latestYesPrice: prices.yes,
      latestNoPrice: prices.no,
      status: row.status,
      pnlAmount: String(row.pnl_amount),
      updatedAt: row.updated_at,
    };
  };

  const openPositions = positions
    .filter((p) => p.status === "open")
    .map(mapPosition);

  const settledPositions = positions
    .filter((p) => p.status === "settled" || p.status === "cancelled")
    .map(mapPosition);

  const recentTrades = trades.map((row): PortfolioTrade => ({
    id: row.id,
    marketId: row.market_id,
    marketTitle: row.markets?.title ?? "—",
    marketTitleZh: row.markets?.title_zh ?? null,
    marketSlug: row.markets?.slug ?? "",
    side: row.side,
    amount: String(row.amount),
    price: String(row.price),
    feeAmount: String(row.fee_amount),
    positionUnits: String(row.position_units),
    status: row.status,
    createdAt: row.created_at,
  }));

  return { openPositions, settledPositions, recentTrades };
}
