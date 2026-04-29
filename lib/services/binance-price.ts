/**
 * Server-side Binance spot price fetcher.
 * Uses the public REST API — no API key required.
 */
export async function getBinanceSpotPrice(binanceSymbol: string): Promise<number> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Binance price fetch failed for ${binanceSymbol}: HTTP ${res.status}`,
    );
  }

  const data = (await res.json()) as { symbol: string; price: string };

  const price = parseFloat(data.price);
  if (isNaN(price) || price <= 0) {
    throw new Error(`Invalid price received from Binance for ${binanceSymbol}: ${data.price}`);
  }

  return price;
}
