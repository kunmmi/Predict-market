"use client";

import { useEffect, useRef, useState } from "react";

export type BinancePriceState = {
  price: number | null;
  prevPrice: number | null;
  error: string | null;
};

type BinanceTradeMessage = {
  p?: string;
};

/**
 * Streams live prices from Binance over WebSocket.
 * Falls back to an initial REST fetch so the UI has a price immediately.
 */
export function useBinancePrice(binanceSymbol: string | null): BinancePriceState {
  const [state, setState] = useState<BinancePriceState>({
    price: null,
    prevPrice: null,
    error: null,
  });

  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!binanceSymbol) return;
    const symbol = binanceSymbol;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    function updatePrice(nextPrice: number) {
      if (cancelled || Number.isNaN(nextPrice)) return;

      setState((prev) => {
        prevPriceRef.current = prev.price;
        return {
          price: nextPrice,
          prevPrice: prevPriceRef.current,
          error: null,
        };
      });
    }

    async function fetchInitialPrice() {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as { price: string };
        updatePrice(parseFloat(data.price));
      } catch (err) {
        if (cancelled) return;

        const message = err instanceof Error ? err.message : "Initial price fetch failed";
        if (message !== "AbortError") {
          setState((prev) => ({ ...prev, error: message }));
        }
      }
    }

    function connect() {
      if (cancelled) return;

      socket = new WebSocket(
        `wss://stream.binance.com:9443/ws/${encodeURIComponent(symbol.toLowerCase())}@trade`,
      );

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as BinanceTradeMessage;
          if (!data.p) return;
          updatePrice(parseFloat(data.p));
        } catch {
          // Ignore malformed messages from the stream.
        }
      };

      socket.onerror = () => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, error: "Live price stream unavailable." }));
      };

      socket.onclose = () => {
        if (cancelled) return;

        reconnectTimer = setTimeout(() => {
          connect();
        }, 1_500);
      };
    }

    void fetchInitialPrice();
    connect();

    return () => {
      cancelled = true;
      controller.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else if (socket && socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [binanceSymbol]);

  return state;
}
