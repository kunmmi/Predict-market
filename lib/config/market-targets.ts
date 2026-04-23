export type MarketTargetDirection = "above" | "below";

export type MarketTarget = {
  asset: string;
  targetPrice: number;
  direction: MarketTargetDirection;
};

export const MARKET_TARGETS: Record<string, MarketTarget> = {
  "btc-100k-june-2026": { asset: "BTC", targetPrice: 100_000, direction: "above" },
  "eth-3k-may-2026": { asset: "ETH", targetPrice: 3_000, direction: "above" },
  "bnb-700-july-2026": { asset: "BNB", targetPrice: 700, direction: "above" },
  "sol-300-q3-2026": { asset: "SOL", targetPrice: 300, direction: "above" },
  "xrp-5-end-2026": { asset: "XRP", targetPrice: 5, direction: "above" },
  "btc-150k-end-2026": { asset: "BTC", targetPrice: 150_000, direction: "above" },
  "doge-1-end-2026": { asset: "DOGE", targetPrice: 1, direction: "above" },
};

export const ASSET_ANNUALISED_VOLATILITY: Record<string, number> = {
  BTC: 0.65,
  ETH: 0.8,
  SOL: 1,
  BNB: 0.7,
  XRP: 0.9,
  DOGE: 1.2,
  ADA: 0.9,
};

export const COINGECKO_ASSET_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
};
