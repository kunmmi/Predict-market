"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CandlestickData, UTCTimestamp } from "lightweight-charts";

export type BinanceStreamStatus = "loading" | "connected" | "disconnected" | "reconnecting";

export type LiveKlineCandle = CandlestickData<UTCTimestamp> & {
  closeTimeMs: number;
  sourceTimeMs: number;
};

type BinanceKlineEvent = {
  k?: {
    t?: number;
    T?: number;
    o?: string;
    h?: string;
    l?: string;
    c?: string;
  };
};

type UseBinanceKlineStreamOptions = {
  interval?: "1m";
  limit?: number;
};

function toCandle(raw: unknown[]): LiveKlineCandle | null {
  const [openTime, open, high, low, close, , closeTime] = raw;
  const openNumber = Number(open);
  const highNumber = Number(high);
  const lowNumber = Number(low);
  const closeNumber = Number(close);

  if (
    !Number.isFinite(Number(openTime)) ||
    !Number.isFinite(Number(closeTime)) ||
    !Number.isFinite(openNumber) ||
    !Number.isFinite(highNumber) ||
    !Number.isFinite(lowNumber) ||
    !Number.isFinite(closeNumber)
  ) {
    return null;
  }

  return {
    time: Math.floor(Number(openTime) / 1000) as UTCTimestamp,
    open: openNumber,
    high: highNumber,
    low: lowNumber,
    close: closeNumber,
    sourceTimeMs: Number(openTime),
    closeTimeMs: Number(closeTime),
  };
}

function toLiveCandle(message: BinanceKlineEvent): LiveKlineCandle | null {
  const kline = message.k;
  if (!kline?.t || !kline?.T || !kline.o || !kline.h || !kline.l || !kline.c) return null;

  const open = Number(kline.o);
  const high = Number(kline.h);
  const low = Number(kline.l);
  const close = Number(kline.c);

  if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return null;
  }

  return {
    time: Math.floor(kline.t / 1000) as UTCTimestamp,
    open,
    high,
    low,
    close,
    sourceTimeMs: kline.t,
    closeTimeMs: kline.T,
  };
}

function upsertCandles(previous: LiveKlineCandle[], next: LiveKlineCandle, limit: number): LiveKlineCandle[] {
  if (previous.length === 0) return [next];

  // Look up by time across the whole array, not just the last entry.
  // Otherwise polling that fetches recent N candles can append duplicates
  // out-of-order, which lightweight-charts rejects with "Value is null".
  const existingIdx = previous.findIndex((c) => c.sourceTimeMs === next.sourceTimeMs);
  if (existingIdx >= 0) {
    // Update in place
    const copy = previous.slice();
    copy[existingIdx] = next;
    return copy;
  }

  // Newer than everything we have → append, drop oldest beyond limit
  const last = previous[previous.length - 1];
  if (next.sourceTimeMs > last.sourceTimeMs) {
    return [...previous, next].slice(-limit);
  }

  // Older than our latest but not already present (rare/corrupt data) — ignore
  // rather than insert out of order.
  return previous;
}

export function useBinanceKlineStream(
  symbol: string | null,
  options?: UseBinanceKlineStreamOptions,
) {
  const interval = options?.interval ?? "1m";
  const limit = options?.limit ?? 120;
  const [candles, setCandles] = useState<LiveKlineCandle[]>([]);
  const [latestCandle, setLatestCandle] = useState<LiveKlineCandle | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<BinanceStreamStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [seedVersion, setSeedVersion] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const reconnectAttemptRef = useRef(0);

  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!symbol) {
      setCandles([]);
      setLatestCandle(null);
      setCurrentPrice(null);
      setStatus("disconnected");
      setError("No Binance symbol is configured for this asset.");
      return;
    }

    const resolvedSymbol = symbol;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    setStatus("loading");
    setError(null);

    async function fetchKlines(klimit: number): Promise<LiveKlineCandle[]> {
      // Always go through our server proxy so users behind firewalls
      // (e.g. China, blocking api.binance.com) still get chart data.
      const response = await fetch(
        `/api/market/klines?symbol=${encodeURIComponent(resolvedSymbol)}&interval=${interval}&limit=${klimit}`,
        { signal: controller.signal, cache: "no-store" },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as unknown[];
      return json
        .map((item) => (Array.isArray(item) ? toCandle(item) : null))
        .filter((item): item is LiveKlineCandle => item != null);
    }

    async function loadSnapshot() {
      try {
        const snapshot = await fetchKlines(limit);
        if (cancelled) return;
        setCandles(snapshot);
        const last = snapshot[snapshot.length - 1] ?? null;
        setLatestCandle(last);
        setCurrentPrice(last?.close ?? null);
        setSeedVersion((value) => value + 1);
        setStatus("connected");
        setError(null);
        reconnectAttemptRef.current = 0;
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load chart data.";
        setError(message);
        setStatus("reconnecting");
      }
    }

    async function pollUpdate() {
      if (cancelled) return;
      // Skip the network call entirely when tab isn't visible — saves
      // bandwidth, Vercel function invocations, and battery on mobile.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        pollTimer = setTimeout(pollUpdate, 2_000);
        return;
      }
      try {
        // Fetch the last 2 candles — enough to update both the current
        // forming candle and confirm the previous closed one.
        const recent = await fetchKlines(2);
        if (cancelled || recent.length === 0) return;
        const last = recent[recent.length - 1];
        setLatestCandle(last);
        setCurrentPrice(last.close);
        setCandles((prev) => {
          let next = prev;
          for (const c of recent) {
            next = upsertCandles(next, c, limit);
          }
          return next;
        });
        if (status !== "connected") {
          setStatus("connected");
          setError(null);
        }
        reconnectAttemptRef.current = 0;
      } catch {
        // Soft-fail; retry on next tick
        reconnectAttemptRef.current += 1;
        if (reconnectAttemptRef.current > 3) {
          setStatus("reconnecting");
        }
      } finally {
        if (!cancelled) {
          pollTimer = setTimeout(pollUpdate, 2_000);
        }
      }
    }

    void loadSnapshot().then(() => {
      if (!cancelled) {
        pollTimer = setTimeout(pollUpdate, 2_000);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
      if (pollTimer) clearTimeout(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, limit, reloadKey, symbol]);

  return useMemo(
    () => ({
      candles,
      currentPrice,
      error,
      latestCandle,
      reconnect,
      seedVersion,
      status,
    }),
    [candles, currentPrice, error, latestCandle, reconnect, seedVersion, status],
  );
}
