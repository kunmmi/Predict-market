"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { Locale, T } from "@/lib/i18n/translations";
import { sideLabel } from "@/lib/i18n/labels";

export type CarouselMarket = {
  id: string;
  title: string;
  titleZh: string | null;
  slug: string;
  assetSymbol: string;
  yesPrice: string | null;
  noPrice: string | null;
  closeAt: string;
};

type Props = {
  markets: CarouselMarket[];
  isLoggedIn: boolean;
  locale: Locale;
  tCarousel: T["carousel"];
};

function formatPrice(p: string | null): string {
  if (p == null) return "—";
  return "$" + parseFloat(p).toFixed(2);
}

function formatPct(p: string | null): string {
  if (p == null) return "—";
  return (parseFloat(p) * 100).toFixed(0) + "%";
}

function formatCloseDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MarketCarousel({ markets, isLoggedIn, locale, tCarousel: tc }: Props) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (animating || index === current) return;
      setAnimating(true);
      setTimeout(() => {
        setCurrent(index);
        setAnimating(false);
      }, 180);
    },
    [animating, current],
  );

  const prev = useCallback(() => {
    goTo((current - 1 + markets.length) % markets.length);
  }, [current, markets.length, goTo]);

  const next = useCallback(() => {
    goTo((current + 1) % markets.length);
  }, [current, markets.length, goTo]);

  useEffect(() => {
    if (markets.length <= 1) return;
    const id = setInterval(next, 4000);
    return () => clearInterval(id);
  }, [markets.length, next]);

  if (markets.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-xs text-slate-400">{tc.markets_label}</p>
        <p className="mt-3 text-base font-medium text-slate-300">{tc.no_markets}</p>
        <p className="mt-1 text-xs text-slate-500">{tc.check_back}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-800 px-3 py-2.5 text-center text-sm font-semibold text-slate-500">YES</div>
          <div className="rounded-lg bg-slate-800 px-3 py-2.5 text-center text-sm font-semibold text-slate-500">NO</div>
        </div>
      </div>
    );
  }

  const market = markets[current];
  const tradeHref = isLoggedIn ? `/markets/${market.slug}` : `/signup`;

  return (
    <div>
      {/* Dark market card */}
      <div
        className="rounded-2xl bg-slate-900 p-5 text-white transition-opacity duration-200"
        style={{ opacity: animating ? 0 : 1 }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold tracking-wide text-slate-300">
            {market.assetSymbol}
          </span>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            <span>{tc.closes} {formatCloseDate(market.closeAt, locale)}</span>
          </div>
        </div>

        {/* Title */}
        <p className="mt-3 min-h-[2.5rem] text-sm font-semibold leading-snug text-white line-clamp-2">
          {locale === "zh" && market.titleZh ? market.titleZh : market.title}
        </p>

        {/* Probability bar */}
        {market.yesPrice != null && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, parseFloat(market.yesPrice) * 100)}%` }}
            />
          </div>
        )}

        {/* Price row */}
        <div className="mt-3 flex gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">YES</p>
            <p className="text-2xl font-bold text-emerald-400">{formatPrice(market.yesPrice)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">NO</p>
            <p className="text-2xl font-bold text-red-400">{formatPrice(market.noPrice)}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href={tradeHref}
            className="rounded-lg bg-emerald-500 px-3 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-emerald-400"
          >
            {sideLabel("yes", locale)} ↑
          </Link>
          <Link
            href={tradeHref}
            className="rounded-lg bg-red-500 px-3 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-red-400"
          >
            {sideLabel("no", locale)} ↓
          </Link>
        </div>
      </div>

      {/* Stat boxes + navigation */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{tc.yes_prob}</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-600">{formatPct(market.yesPrice)}</p>
        </div>

        {markets.length > 1 && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous market"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next market"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-1">
              {markets.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Market ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? "w-5 bg-slate-900" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{tc.no_prob}</p>
          <p className="mt-0.5 text-lg font-bold text-red-500">{formatPct(market.noPrice)}</p>
        </div>
      </div>
    </div>
  );
}
