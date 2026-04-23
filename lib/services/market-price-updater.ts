import {
  ASSET_ANNUALISED_VOLATILITY,
  COINGECKO_ASSET_IDS,
  MARKET_TARGETS,
  type MarketTargetDirection,
} from "@/lib/config/market-targets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365;
const DEFAULT_ANNUALISED_VOLATILITY = 0.8;
const MIN_DISPLAY_PROBABILITY = 0.03;
const MAX_DISPLAY_PROBABILITY = 0.97;

export type UpdateResult = {
  slug: string;
  asset: string;
  currentPrice: number;
  targetPrice: number;
  yesProbability: number;
  updated: boolean;
  skipped?: string;
};

async function fetchCurrentPrices(assets: string[]): Promise<Record<string, number>> {
  const ids = Array.from(
    new Set(
      assets
        .map((asset) => COINGECKO_ASSET_IDS[asset])
        .filter((assetId): assetId is string => Boolean(assetId)),
    ),
  );

  if (ids.length === 0) return {};

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(
    ",",
  )}&vs_currencies=usd`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(`CoinGecko price fetch failed with status ${res.status}.`);
  }

  const data = (await res.json()) as Record<string, { usd?: number }>;
  const prices: Record<string, number> = {};

  for (const [symbol, geckoId] of Object.entries(COINGECKO_ASSET_IDS)) {
    const usd = data[geckoId]?.usd;
    if (typeof usd === "number" && usd > 0) {
      prices[symbol] = usd;
    }
  }

  return prices;
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.39894228 * Math.exp(-0.5 * x * x);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));

  return x >= 0 ? 1 - p : p;
}

function clampDisplayProbability(probability: number): number {
  return Math.max(MIN_DISPLAY_PROBABILITY, Math.min(MAX_DISPLAY_PROBABILITY, probability));
}

export function calcProbability(
  currentPrice: number,
  targetPrice: number,
  direction: MarketTargetDirection,
  annualisedVolatility: number,
  yearsRemaining: number,
): number {
  if (currentPrice <= 0 || targetPrice <= 0 || annualisedVolatility <= 0) {
    return MIN_DISPLAY_PROBABILITY;
  }

  if (yearsRemaining <= 0) {
    if (direction === "above") {
      return currentPrice >= targetPrice ? MAX_DISPLAY_PROBABILITY : MIN_DISPLAY_PROBABILITY;
    }

    return currentPrice <= targetPrice ? MAX_DISPLAY_PROBABILITY : MIN_DISPLAY_PROBABILITY;
  }

  if (direction === "above" && currentPrice >= targetPrice) return MAX_DISPLAY_PROBABILITY;
  if (direction === "below" && currentPrice <= targetPrice) return MAX_DISPLAY_PROBABILITY;

  const logDistance = Math.abs(Math.log(targetPrice / currentPrice));
  const z = logDistance / (annualisedVolatility * Math.sqrt(yearsRemaining));
  return clampDisplayProbability(2 * normalCDF(-z));
}

export async function updateAllMarketPrices(): Promise<UpdateResult[]> {
  const supabase = createSupabaseAdminClient();
  const slugs = Object.keys(MARKET_TARGETS);

  if (slugs.length === 0) return [];

  const { data: markets, error } = await supabase
    .from("markets")
    .select("id, slug, close_at")
    .in("slug", slugs)
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to fetch markets for price update: ${error.message}`);
  }

  if (!markets || markets.length === 0) return [];

  const assetsNeeded = markets.map((market) => MARKET_TARGETS[market.slug as string]!.asset);
  const prices = await fetchCurrentPrices(assetsNeeded);
  const results: UpdateResult[] = [];

  for (const market of markets) {
    const slug = market.slug as string;
    const target = MARKET_TARGETS[slug]!;
    const currentPrice = prices[target.asset];

    if (!currentPrice) {
      results.push({
        slug,
        asset: target.asset,
        currentPrice: 0,
        targetPrice: target.targetPrice,
        yesProbability: 0,
        updated: false,
        skipped: "Price unavailable",
      });
      continue;
    }

    const closeAt = new Date(market.close_at as string);
    const yearsRemaining = (closeAt.getTime() - Date.now()) / MS_PER_YEAR;
    const annualisedVolatility =
      ASSET_ANNUALISED_VOLATILITY[target.asset] ?? DEFAULT_ANNUALISED_VOLATILITY;
    const yesProbability = calcProbability(
      currentPrice,
      target.targetPrice,
      target.direction,
      annualisedVolatility,
      yearsRemaining,
    );
    const yesPrice = Number(yesProbability.toFixed(4));
    const noPrice = Number((1 - yesPrice).toFixed(4));

    const { error: insertError } = await supabase.from("market_prices").insert({
      market_id: market.id,
      yes_price: yesPrice,
      no_price: noPrice,
      source: "coingecko_barrier_model",
    });

    results.push({
      slug,
      asset: target.asset,
      currentPrice,
      targetPrice: target.targetPrice,
      yesProbability: yesPrice,
      updated: !insertError,
      skipped: insertError?.message,
    });
  }

  return results;
}
