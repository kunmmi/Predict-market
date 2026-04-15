/**
 * Fetches live crypto prices in USD via CoinGecko's free public API.
 * Stablecoins (USDT, USDC) are always 1.00.
 */

type PriceMap = Record<string, number>;

const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
};

// Simple in-process cache — prices are valid for 60 seconds
let cache: { prices: PriceMap; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function fetchPrices(): Promise<PriceMap> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Next.js fetch cache — revalidate every 60s
    next: { revalidate: 60 },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(`CoinGecko price fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, { usd: number }>;

  const prices: PriceMap = {};
  for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
    prices[symbol] = data[id]?.usd ?? 0;
  }
  return prices;
}

async function getPrices(): Promise<PriceMap> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.prices;
  }
  const prices = await fetchPrices();
  cache = { prices, fetchedAt: now };
  return prices;
}

/**
 * Returns the USD price for a given asset symbol.
 * Stablecoins return 1. Throws if price cannot be fetched.
 */
export async function getAssetUsdPrice(
  asset: "ETH" | "BNB" | "SOL" | "USDT" | "USDC",
): Promise<number> {
  if (asset === "USDT" || asset === "USDC") return 1;
  const prices = await getPrices();
  const price = prices[asset];
  if (!price || price <= 0) throw new Error(`Could not fetch price for ${asset}.`);
  return price;
}

/**
 * Converts a USD amount to the equivalent crypto amount.
 * e.g. usdToAsset(100, 'ETH') when ETH=$3500 → 0.02857...
 */
export async function usdToAsset(
  usdAmount: number,
  asset: "ETH" | "BNB" | "SOL" | "USDT" | "USDC",
): Promise<number> {
  const price = await getAssetUsdPrice(asset);
  return usdAmount / price;
}
