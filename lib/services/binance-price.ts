const BINANCE_HOSTS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
];

// CoinGecko IDs for assets we support — used as fallback when Binance is geo-blocked (HTTP 451).
const BINANCE_SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTCUSDT:  "bitcoin",
  ETHUSDT:  "ethereum",
  SOLUSDT:  "solana",
  BNBUSDT:  "binancecoin",
  XRPUSDT:  "ripple",
  ADAUSDT:  "cardano",
  DOGEUSDT: "dogecoin",
};

async function fetchFromCoinGecko(binanceSymbol: string): Promise<number> {
  const coinId = BINANCE_SYMBOL_TO_COINGECKO[binanceSymbol];
  if (!coinId) throw new Error(`No CoinGecko mapping for ${binanceSymbol}`);

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`CoinGecko price fetch failed for ${coinId}: HTTP ${res.status}`);

  const data = (await res.json()) as Record<string, { usd?: number }>;
  const price = data[coinId]?.usd;

  if (!price || price <= 0) throw new Error(`Invalid price from CoinGecko for ${coinId}`);
  return price;
}

/**
 * Server-side spot price fetcher.
 * Tries all Binance base URLs first; falls back to CoinGecko if Binance is
 * geo-blocked (HTTP 451) or otherwise unreachable.
 */
export async function getBinanceSpotPrice(binanceSymbol: string): Promise<number> {
  const path = `/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`;
  let binanceBlocked = false;
  let lastError: Error = new Error("No price sources available");

  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });

      if (res.status === 451) {
        binanceBlocked = true;
        break; // All Binance hosts will return the same geo-block — skip straight to fallback.
      }

      if (!res.ok) {
        lastError = new Error(`Binance price fetch failed for ${binanceSymbol}: HTTP ${res.status}`);
        continue;
      }

      const data = (await res.json()) as { symbol: string; price: string };
      const price = parseFloat(data.price);

      if (isNaN(price) || price <= 0) {
        lastError = new Error(`Invalid price received from Binance for ${binanceSymbol}: ${data.price}`);
        continue;
      }

      return price;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (binanceBlocked || lastError) {
    try {
      return await fetchFromCoinGecko(binanceSymbol);
    } catch (fallbackErr) {
      lastError = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
    }
  }

  throw lastError;
}
