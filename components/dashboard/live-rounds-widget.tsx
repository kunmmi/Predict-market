"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, Clock } from "lucide-react";

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
      className={`flex flex-col rounded-xl border-2 p-4 transition-all ${
        isClosed
          ? "border-slate-200 bg-slate-50 opacity-70"
          : "border-yellow-200 bg-white shadow-sm"
      }`}
    >
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">
            {hasCryptoIcon(market.assetSymbol) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cryptoIconUrl(market.assetSymbol)}
                alt={market.assetSymbol}
                width={14}
                height={14}
                className="rounded-full"
              />
            )}
            {market.assetSymbol}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {market.durationMinutes} min
          </span>
          {!isClosed && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          )}
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

export function LiveRoundsWidget({
  markets,
}: {
  markets: DashboardLiveRound[];
  locale: Locale;
}) {
  if (markets.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Live Rounds
        </h2>
        <Link
          href="/markets"
          className="text-xs font-semibold text-yellow-600 hover:text-yellow-700"
        >
          All markets →
        </Link>
      </div>
      <div
        className={`grid gap-3 ${
          markets.length === 1
            ? "grid-cols-1 sm:max-w-xs"
            : markets.length === 2
              ? "sm:grid-cols-2"
              : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {markets.map((m) => (
          <LiveRoundCard key={m.id} market={m} />
        ))}
      </div>
    </div>
  );
}
