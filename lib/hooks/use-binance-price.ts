"use client";

import { useEffect, useRef, useState } from "react";

export type BinancePriceState = {
  price: number | null;
  prevPrice: number | null;
  error: string | null;
};

/**
 * Polls the Binance public REST API every `intervalMs` milliseconds.
 * Returns the current price and the previous price (for flash animations).
 * Cleans up on unmount.
 */
export function useBinancePrice(
  binanceSymbol: string | null,
  intervalMs = 10_000,
): BinancePriceState {
  const [state, setState] = useState<BinancePriceState>({
    price: null,
    prevPrice: null,
    error: null,
  });

  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!binanceSymbol) return;

    let aborted = false;
    const controller = new AbortController();

    async function fetchPrice() {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol!)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { price: string };
        const newPrice = parseFloat(data.price);
        if (!isNaN(newPrice) && !aborted) {
          setState((prev) => {
            prevPriceRef.current = prev.price;
            return { price: newPrice, prevPrice: prevPriceRef.current, error: null };
          });
        }
      } catch (err) {
        if (!aborted) {
          const msg = err instanceof Error ? err.message : "Price fetch failed";
          if (msg !== "AbortError") {
            setState((prev) => ({ ...prev, error: msg }));
          }
        }
      }
    }

    // Fetch immediately, then on interval
    fetchPrice();
    const id = setInterval(fetchPrice, intervalMs);

    return () => {
      aborted = true;
      controller.abort();
      clearInterval(id);
    };
  }, [binanceSymbol, intervalMs]);

  return state;
}
