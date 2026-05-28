import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardOpenPosition = {
  id: string;
  marketId: string;
  marketTitle: string;
  marketTitleZh: string | null;
  marketSlug: string;
  yesUnits: string;
  noUnits: string;
  status: string;
};

export type DashboardTrade = {
  id: string;
  marketTitle: string;
  marketTitleZh: string | null;
  marketSlug: string;
  side: string;
  amount: string;
  price: string;
  feeAmount: string;
  createdAt: string;
};

export type DashboardDeposit = {
  id: string;
  assetSymbol: string;
  status: string;
  amountExpected: string | null;
  amountReceived: string | null;
  createdAt: string;
};

export type DashboardPromoter = {
  id: string;
  displayName: string | null;
  promoCode: string;
  status: string;
  commissionRate: string;
  totalCommissionGenerated: string;
};

export type DashboardLiveRound = {
  id: string;
  title: string;
  titleZh: string | null;
  slug: string;
  assetSymbol: string;
  closeAt: string;
  cutoffAt: string | null;
  spotPriceAtOpen: string | null;
  durationMinutes: number;
};

export type DashboardData = {
  openPositions: DashboardOpenPosition[];
  recentTrades: DashboardTrade[];
  recentDeposits: DashboardDeposit[];
  promoter: DashboardPromoter | null;
  liveRounds: DashboardLiveRound[];
};

type MarketJoin = { title: string; titleZh: string | null; slug: string } | null;

function marketFromJoin(raw: unknown): MarketJoin {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const first = raw[0] as { title?: string; title_zh?: string | null; slug?: string } | undefined;
    if (!first?.title || first.slug === undefined) return null;
    return { title: first.title, titleZh: first.title_zh ?? null, slug: first.slug };
  }
  const o = raw as { title?: string; title_zh?: string | null; slug?: string };
  if (!o.title || o.slug === undefined) return null;
  return { title: o.title, titleZh: o.title_zh ?? null, slug: o.slug };
}

type DepositRow = {
  id: string;
  asset_symbol: string;
  status: string;
  amount_expected: string | number | null;
  amount_received: string | number | null;
  created_at: string;
};

type PromoterRow = {
  id: string;
  display_name: string | null;
  promo_code: string;
  status: string;
  commission_rate: string | number;
  total_commission_generated: string | number;
};

function toStr(v: string | number | null | undefined): string | null {
  if (v == null) return null;
  return String(v);
}

export async function getDashboardData(profileId: string): Promise<DashboardData> {
  const supabase = createSupabaseServerClient();

  const [positionsRes, tradesRes, depositsRes, promoterRes, liveRoundsRes] = await Promise.all([
    supabase
      .from("positions")
      .select(
        "id, market_id, yes_units, no_units, status, markets ( title, title_zh, slug )",
      )
      .eq("profile_id", profileId)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("trades")
      .select(
        "id, side, amount, price, fee_amount, created_at, markets ( title, title_zh, slug )",
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("deposits")
      .select(
        "id, asset_symbol, status, amount_expected, amount_received, created_at",
      )
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("promoters")
      .select(
        "id, display_name, promo_code, status, commission_rate, total_commission_generated",
      )
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("markets")
      .select("id, title, title_zh, slug, asset_symbol, close_at, cutoff_at, spot_price_at_open, duration_minutes")
      .eq("status", "active")
      .not("duration_minutes", "is", null)
      .order("close_at", { ascending: true })
      .limit(6),
  ]);

  const openPositions: DashboardOpenPosition[] = (positionsRes.data ?? [])
    .map((row) => {
      const r = row as {
        id: string;
        market_id: string;
        yes_units: string | number;
        no_units: string | number;
        status: string;
        markets: unknown;
      };
      const m = marketFromJoin(r.markets);
      return {
        id: r.id,
        marketId: r.market_id,
        marketTitle: m?.title ?? "Market",
        marketTitleZh: m?.titleZh ?? null,
        marketSlug: m?.slug ?? "",
        yesUnits: String(r.yes_units),
        noUnits: String(r.no_units),
        status: r.status,
      };
    })
    .filter(
      (p) =>
        Number.parseFloat(p.yesUnits) > 0 || Number.parseFloat(p.noUnits) > 0,
    );

  const recentTrades: DashboardTrade[] = (tradesRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      side: string;
      amount: string | number;
      price: string | number;
      fee_amount: string | number;
      created_at: string;
      markets: unknown;
    };
    const m = marketFromJoin(r.markets);
    return {
      id: r.id,
      marketTitle: m?.title ?? "Market",
      marketTitleZh: m?.titleZh ?? null,
      marketSlug: m?.slug ?? "",
      side: r.side,
      amount: String(r.amount),
      price: String(r.price),
      feeAmount: String(r.fee_amount),
      createdAt: r.created_at,
    };
  });

  const recentDeposits: DashboardDeposit[] = (depositsRes.data ?? []).map(
    (row) => {
      const r = row as DepositRow;
      return {
        id: r.id,
        assetSymbol: r.asset_symbol,
        status: r.status,
        amountExpected: toStr(r.amount_expected),
        amountReceived: toStr(r.amount_received),
        createdAt: r.created_at,
      };
    },
  );

  let promoter: DashboardPromoter | null = null;
  if (promoterRes.data && !promoterRes.error) {
    const pr = promoterRes.data as PromoterRow;
    promoter = {
      id: pr.id,
      displayName: pr.display_name,
      promoCode: pr.promo_code,
      status: pr.status,
      commissionRate: String(pr.commission_rate),
      totalCommissionGenerated: String(pr.total_commission_generated),
    };
  }

  const liveRounds: DashboardLiveRound[] = (liveRoundsRes.data ?? []).map((row) => {
    const r = row as {
      id: string;
      title: string;
      title_zh: string | null;
      slug: string;
      asset_symbol: string;
      close_at: string;
      cutoff_at: string | null;
      spot_price_at_open: string | number | null;
      duration_minutes: number;
    };
    return {
      id: r.id,
      title: r.title,
      titleZh: r.title_zh,
      slug: r.slug,
      assetSymbol: r.asset_symbol,
      closeAt: r.close_at,
      cutoffAt: r.cutoff_at,
      spotPriceAtOpen: r.spot_price_at_open != null ? String(r.spot_price_at_open) : null,
      durationMinutes: r.duration_minutes,
    };
  });

  return {
    openPositions,
    recentTrades,
    recentDeposits,
    promoter,
    liveRounds,
  };
}
