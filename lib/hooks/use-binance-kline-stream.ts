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

  const last = previous[previous.length - 1];
  if (!last) return [next];

  if (last.sourceTimeMs === next.sourceTimeMs) {
    return [...previous.slice(0, -1), next];
  }

  return [...previous, next].slice(-limit);
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
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    setStatus("loading");
    setError(null);

    async function loadSnapshot() {
      try {
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(resolvedSymbol)}&interval=${interval}&limit=${limit}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as unknown[];
        const snapshot = json
          .map((item) => (Array.isArray(item) ? toCandle(item) : null))
          .filter((item): item is LiveKlineCandle => item != null);

        if (cancelled) return;

        setCandles(snapshot);
        const last = snapshot[snapshot.length - 1] ?? null;
        setLatestCandle(last);
        setCurrentPrice(last?.close ?? null);
        setSeedVersion((value) => value + 1);
      } catch (streamError) {
        if (cancelled) return;

        const message =
          streamError instanceof Error ? streamError.message : "Failed to load initial Binance candles.";
        setError(message);
      }
    }

    function scheduleReconnect() {
      if (cancelled) return;

      reconnectAttemptRef.current += 1;
      const delay = Math.min(8_000, 1_000 * 2 ** Math.min(reconnectAttemptRef.current, 3));
      setStatus("reconnecting");

      reconnectTimer = setTimeout(() => {
        void loadSnapshot().finally(connectSocket);
      }, delay);
    }

    function connectSocket() {
      if (cancelled) return;

      socket = new WebSocket(
        `wss://stream.binance.com:9443/ws/${encodeURIComponent(resolvedSymbol.toLowerCase())}@kline_${interval}`,
      );

      socket.onopen = () => {
        if (cancelled) return;
        reconnectAttemptRef.current = 0;
        setStatus("connected");
        setError(null);
      };

      socket.onmessage = (event) => {
        if (cancelled) return;

        try {
          const payload = JSON.parse(event.data) as BinanceKlineEvent;
          const candle = toLiveCandle(payload);
          if (!candle) return;

          setLatestCandle(candle);
          setCurrentPrice(candle.close);
          setCandles((previous) => upsertCandles(previous, candle, limit));
        } catch {
          setError("Received an invalid Binance stream payload.");
        }
      };

      socket.onerror = () => {
        if (cancelled) return;
        setError("The live Binance stream is unavailable right now.");
      };

      socket.onclose = () => {
        if (cancelled) return;
        scheduleReconnect();
      };
    }

    void loadSnapshot().finally(connectSocket);

    return () => {
      cancelled = true;
      controller.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
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
