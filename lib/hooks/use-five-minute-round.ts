"use client";

import { useEffect, useMemo, useState } from "react";

export type RoundDirection = "up" | "down" | "flat";

type UseFiveMinuteRoundOptions = {
  currentPrice: number | null;
  durationMinutes?: number | null;
  initialReferencePrice?: number | null;
  initialRoundEndAt?: string | number | null;
};

function nextBoundary(now: number, durationMs: number) {
  return now - (now % durationMs) + durationMs;
}

function comparePrices(current: number, reference: number): RoundDirection {
  if (current > reference) return "up";
  if (current < reference) return "down";
  return "flat";
}

export function useFiveMinuteRound({
  currentPrice,
  durationMinutes,
  initialReferencePrice,
  initialRoundEndAt,
}: UseFiveMinuteRoundOptions) {
  const durationMs = Math.max(1, durationMinutes ?? 5) * 60_000;
  const initialRoundEndAtMs = useMemo(() => {
    if (!initialRoundEndAt) return NaN;
    return new Date(initialRoundEndAt).getTime();
  }, [initialRoundEndAt]);
  const [now, setNow] = useState<number | null>(null);
  const [openingPrice, setOpeningPrice] = useState<number | null>(initialReferencePrice ?? null);
  const [lastResult, setLastResult] = useState<RoundDirection | null>(null);
  const [roundEndAtMs, setRoundEndAtMs] = useState(() => {
    const next = initialRoundEndAtMs;
    if (Number.isFinite(next) && next > Date.now()) return next;
    return nextBoundary(Date.now(), durationMs);
  });

  useEffect(() => {
    setNow(Date.now());

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nextNow = Date.now();
    const nextRoundEndAt =
      Number.isFinite(initialRoundEndAtMs) && initialRoundEndAtMs > nextNow
        ? initialRoundEndAtMs
        : nextBoundary(nextNow, durationMs);

    setNow(nextNow);
    setRoundEndAtMs(nextRoundEndAt);
    setOpeningPrice(initialReferencePrice ?? null);
    setLastResult(null);
  }, [durationMs, initialReferencePrice, initialRoundEndAtMs]);

  useEffect(() => {
    if (openingPrice == null) {
      if (initialReferencePrice != null) {
        setOpeningPrice(initialReferencePrice);
        return;
      }

      if (currentPrice != null) {
        setOpeningPrice(currentPrice);
      }
    }
  }, [currentPrice, initialReferencePrice, openingPrice]);

  useEffect(() => {
    if (now == null) return;
    if (now < roundEndAtMs || currentPrice == null) return;

    const resolvedOpeningPrice = openingPrice ?? initialReferencePrice ?? currentPrice;
    setLastResult(comparePrices(currentPrice, resolvedOpeningPrice));
    setOpeningPrice(currentPrice);
    setRoundEndAtMs(now + durationMs);
  }, [currentPrice, durationMs, initialReferencePrice, now, openingPrice, roundEndAtMs]);

  const activeOpeningPrice = openingPrice ?? initialReferencePrice ?? null;
  const activeRoundEndAtMs =
    now != null && Number.isFinite(initialRoundEndAtMs) && initialRoundEndAtMs > now
      ? initialRoundEndAtMs
      : roundEndAtMs;
  const priceDifference =
    currentPrice != null && activeOpeningPrice != null ? currentPrice - activeOpeningPrice : null;
  const percentageChange =
    currentPrice != null && activeOpeningPrice != null && activeOpeningPrice > 0
      ? (priceDifference! / activeOpeningPrice) * 100
      : null;
  const liveDirection =
    currentPrice != null && activeOpeningPrice != null
      ? comparePrices(currentPrice, activeOpeningPrice)
      : "flat";

  return useMemo(
    () => ({
      countdownMs: now == null ? null : Math.max(0, activeRoundEndAtMs - now),
      durationMs,
      lastResult,
      liveDirection,
      openingPrice: activeOpeningPrice,
      percentageChange,
      priceDifference,
      roundEndAtMs: activeRoundEndAtMs,
    }),
    [
      activeOpeningPrice,
      activeRoundEndAtMs,
      durationMs,
      lastResult,
      liveDirection,
      now,
      percentageChange,
      priceDifference,
    ],
  );
}
