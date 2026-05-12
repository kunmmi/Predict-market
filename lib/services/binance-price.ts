// Binance exposes several equivalent base URLs. If one is blocked or
// unavailable, the others usually still work.
const BINANCE_HOSTS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
];

/**
 * Server-side Binance spot price fetcher.
 * Tries each base URL in order so a single unreachable host doesn't block settlement.
 */
export async function getBinanceSpotPrice(binanceSymbol: string): Promise<number> {
  const path = `/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`;
  let lastError: Error = new Error("No Binance hosts available");

  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });

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

  throw lastError;
}
