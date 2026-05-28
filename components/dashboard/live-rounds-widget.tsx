"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, Clock, ChevronLeft, ChevronRight } from "lucide-react";

import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { useBinanceKlineStream } from "@/lib/hooks/use-binance-kline-stream";
import { computeBinaryYesPrice, getShortDurationCutoffAt } from "@/lib/short-duration-predictions";
import { OVERROUND } from "@/lib/config/trading-constants";
import { cryptoIconUrl, hasCryptoIcon } from "@/lib/helpers/crypto-icon";
import type { DashboardLiveRound } from "@/lib/services/dashboard-data";
import type { Locale } from "@/lib/i18n/translations";

function applyOverround(p: number): number {
  return Math.max(0.01, Math.min(0.99, p * (1 + OVERROUND)));
}

function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function LiveRoundCard({ market }: { market: DashboardLiveRound }) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const binanceSymbol = ASSET_TO_BINANCE[market.assetSymbol] ?? null;
  const { currentPrice: liveSpot, candles } = useBinanceKlineStream(binanceSymbol);

  const secondsRemaining = Math.max(
    0,
    Math.floor((new Date(market.closeAt).getTime() - now) / 1_000),
  );
  const cutoffAt = market.cutoffAt ?? getShortDurationCutoffAt(market.closeAt).toISOString();
  const isClosed = Math.floor((new Date(cutoffAt).getTime() - now) / 1_000) <= 0;

  const fairYes = useMemo(() => {
    if (liveSpot == null || market.spotPriceAtOpen == null) return 0.5;
    return computeBinaryYesPrice({
      currentSpotPrice: liveSpot,
      openingSpotPrice: Number(market.spotPriceAtOpen),
      secondsRemaining,
      recentCandles: candles,
    });
  }, [liveSpot, market.spotPriceAtOpen, secondsRemaining, candles]);

  const yesPrice = applyOverround(fairYes);
  const noPrice  = applyOverround(1 - fairYes);

  const openingSpot = market.spotPriceAtOpen ? Number(market.spotPriceAtOpen) : null;
  const pctDiff =
    liveSpot != null && openingSpot != null
      ? ((liveSpot - openingSpot) / openingSpot) * 100
      : null;
  const isUp = pctDiff != null ? pctDiff >= 0 : null;

  return (
    <div
      className={`flex h-full flex-col rounded-xl border-2 p-4 transition-all ${
        isClosed
          ? "border-slate-200 bg-slate-50 opacity-70"
          : "border-yellow-200 bg-white shadow-sm"
      }`}
    >
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {hasCryptoIcon(market.assetSymbol) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cryptoIconUrl(market.assetSymbol)}
              alt={market.assetSymbol}
              width={40}
              height={40}
              className="rounded-full shadow-md"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              {market.assetSymbol.slice(0, 2)}
            </span>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold text-slate-900">{market.assetSymbol}</span>
              {!isClosed && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              )}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {market.durationMinutes} min round
            </span>
          </div>
        </div>
        <div
          className={`flex items-center gap-1 text-sm font-bold tabular-nums ${
            isClosed
              ? "text-slate-400"
              : secondsRemaining <= 60
                ? "text-red-600"
                : "text-slate-700"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {isClosed ? "Closed" : formatCountdown(secondsRemaining)}
        </div>
      </div>

      {/* Live spot price + direction */}
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-lg font-bold tabular-nums text-slate-900">
          {liveSpot != null
            ? `$${liveSpot.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "—"}
        </span>
        {pctDiff != null && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              isUp ? "text-green-600" : "text-red-600"
            }`}
          >
            {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(pctDiff).toFixed(3)}% from open
          </span>
        )}
      </div>

      {/* UP / DOWN price tiles */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {[
          { label: "UP",   price: yesPrice, color: "green" },
          { label: "DOWN", price: noPrice,  color: "red"   },
        ].map(({ label, price, color }) => (
          <div
            key={label}
            className={`rounded-lg border-2 p-2 text-center ${
              isClosed
                ? "border-slate-200 bg-slate-50"
                : color === "green"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-widest ${
                color === "green" ? "text-green-700" : "text-red-600"
              }`}
            >
              {label}
            </p>
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {(price * 100).toFixed(0)}¢
            </p>
            <p className="text-[10px] font-semibold text-slate-500">
              {(1 / price).toFixed(2)}× payout
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link
        href={`/markets/${market.slug}`}
        className="mt-auto block w-full rounded-lg bg-yellow-400 py-2 text-center text-sm font-bold text-slate-900 transition-colors hover:bg-yellow-500"
      >
        {isClosed ? "View Round" : "Trade Now →"}
      </Link>
    </div>
  );
}

/** Number of cards visible at a time, per breakpoint. */
function useVisibleCount() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w >= 1024) setCount(3);
      else if (w >= 640) setCount(2);
      else setCount(1);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return count;
}

export function LiveRoundsWidget({
  markets,
}: {
  markets: DashboardLiveRound[];
  locale: Locale;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const visibleCount = useVisibleCount();
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = markets.length;
  // Maximum valid starting index so we never show empty slots
  const maxIndex = Math.max(0, total - visibleCount);

  const prev = useCallback(() => {
    setIndex((i) => (i === 0 ? maxIndex : i - 1));
  }, [maxIndex]);

  const next = useCallback(() => {
    setIndex((i) => (i >= maxIndex ? 0 : i + 1));
  }, [maxIndex]);

  // Auto-advance every 5 s, pauses on hover
  useEffect(() => {
    if (paused || total <= visibleCount) return;
    autoRef.current = setInterval(next, 5_000);
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [paused, next, total, visibleCount]);

  // Clamp index if window resizes to show more cards
  useEffect(() => {
    setIndex((i) => Math.min(i, maxIndex));
  }, [maxIndex]);

  if (total === 0) return null;

  const showArrows = total > visibleCount;

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Live Rounds
          <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            {total}
          </span>
        </h2>
        <Link
          href="/markets"
          className="text-xs font-semibold text-yellow-600 hover:text-yellow-700"
        >
          All markets →
        </Link>
      </div>

      {/* Carousel */}
      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Left arrow */}
        {showArrows && (
          <button
            onClick={prev}
            className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-1.5 shadow-md transition hover:bg-slate-50 active:scale-95"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
        )}

        {/* Sliding window — overflow hidden, items translate */}
        <div className="overflow-hidden">
          <div
            className="flex gap-3 transition-transform duration-500 ease-in-out"
            style={{
              // Each card takes 1/visibleCount of the container width minus gaps
              transform: `translateX(calc(-${index} * (100% / ${visibleCount}) - ${index} * (12px / ${visibleCount})))`,
            }}
          >
            {markets.map((m) => (
              <div
                key={m.id}
                className="min-w-0 shrink-0"
                style={{ width: `calc(${100 / visibleCount}% - ${(12 * (visibleCount - 1)) / visibleCount}px)` }}
              >
                <LiveRoundCard market={m} />
              </div>
            ))}
          </div>
        </div>

        {/* Right arrow */}
        {showArrows && (
          <button
            onClick={next}
            className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-1.5 shadow-md transition hover:bg-slate-50 active:scale-95"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        )}
      </div>

      {/* Dot indicators */}
      {showArrows && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === index
                  ? "h-2 w-5 bg-yellow-400"
                  : "h-2 w-2 bg-slate-200 hover:bg-slate-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
