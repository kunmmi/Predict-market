"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Dot } from "lucide-react";

import type { Locale, T } from "@/lib/i18n/translations";
import { sideLabel } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/badge";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { useBinancePrice } from "@/lib/hooks/use-binance-price";

export type CarouselMarket = {
  id: string;
  title: string;
  titleZh: string | null;
  slug: string;
  assetSymbol: string;
  yesPrice: string | null;
  noPrice: string | null;
  closeAt: string;
  durationMinutes: number | null;
  targetDirection: string | null;
  spotPriceAtOpen: string | null;
};

type Props = {
  markets: CarouselMarket[];
  isLoggedIn: boolean;
  locale: Locale;
  tCarousel: T["carousel"];
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useCountdownLabel(closeAt: string, prefix: string, expiredLabel: string) {
  const closeAtMs = new Date(closeAt).getTime();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(closeAtMs - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [closeAtMs]);

  if (remaining == null) {
    return {
      text: `${prefix} --:--`,
      urgent: false,
      expired: false,
    };
  }

  if (remaining <= 0) {
    return {
      text: expiredLabel,
      urgent: true,
      expired: true,
    };
  }

  return {
    text: `${prefix} ${formatRemaining(remaining)}`,
    urgent: remaining <= 60_000,
    expired: false,
  };
}

function ShortDurationCard({
  market,
  tradeHref,
  locale,
  tc,
}: {
  market: CarouselMarket;
  tradeHref: string;
  locale: Locale;
  tc: T["carousel"];
}) {
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const countdown = useCountdownLabel(
    market.closeAt,
    tc.countdown_closes_in,
    tc.countdown_expired,
  );
  const binanceSymbol = ASSET_TO_BINANCE[market.assetSymbol] ?? null;
  const { price, prevPrice } = useBinancePrice(binanceSymbol, 5000);

  useEffect(() => {
    if (price == null || prevPrice == null || price === prevPrice) return;
    setDirection(price > prevPrice ? "up" : "down");
    const timeoutId = setTimeout(() => setDirection(null), 800);
    return () => clearTimeout(timeoutId);
  }, [price, prevPrice]);

  const priceClassName = useMemo(() => {
    if (direction === "up") return "text-emerald-400";
    if (direction === "down") return "text-rose-400";
    return "text-white";
  }, [direction]);

  return (
    <div
      className="rounded-2xl bg-slate-950 p-5 text-white transition-opacity duration-200"
      style={{ minHeight: 380 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Badge className="bg-yellow-300 text-slate-900 ring-0">{tc.short_duration_badge}</Badge>
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-2.5 py-1 text-[11px] font-medium text-slate-300">
            <Dot className="h-4 w-4 text-emerald-400" />
            {tc.quick_trade}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{market.assetSymbol}</p>
          <p
            className={`mt-1 text-sm font-semibold ${
              countdown.urgent ? "animate-pulse text-rose-400" : "text-slate-200"
            }`}
          >
            {countdown.text}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold leading-snug text-white">
          {locale === "zh" && market.titleZh ? market.titleZh : market.title}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {tc.target_price_label}{" "}
          <span className="font-semibold text-slate-200">
            {market.targetDirection === "below" ? tc.target_below : tc.target_above}
          </span>{" "}
          <span className="font-semibold text-white">
            {market.spotPriceAtOpen != null
              ? `$${priceFormatter.format(Number(market.spotPriceAtOpen))}`
              : "—"}
          </span>
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{tc.live_price}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums transition-colors ${priceClassName}`}>
              {price != null ? `$${priceFormatter.format(price)}` : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-800 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{sideLabel("yes", locale)}</p>
            <p className="mt-1 text-lg font-bold text-emerald-400">{formatPct(market.yesPrice)}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href={tradeHref}
          className="rounded-xl bg-emerald-500 px-4 py-3 text-left text-white transition-colors hover:bg-emerald-400"
        >
          <p className="text-[11px] uppercase tracking-wide text-emerald-50/80">{tc.up_label}</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(market.yesPrice)}</p>
          <p className="mt-1 text-xs font-medium text-emerald-50/90">
            {sideLabel("yes", locale)} ↑
          </p>
        </Link>
        <Link
          href={tradeHref}
          className="rounded-xl bg-rose-500 px-4 py-3 text-left text-white transition-colors hover:bg-rose-400"
        >
          <p className="text-[11px] uppercase tracking-wide text-rose-50/80">{tc.down_label}</p>
          <p className="mt-1 text-xl font-bold">{formatPrice(market.noPrice)}</p>
          <p className="mt-1 text-xs font-medium text-rose-50/90">
            {sideLabel("no", locale)} ↓
          </p>
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{tc.closes}</span>
        <span>{formatCloseDate(market.closeAt, locale)}</span>
      </div>
    </div>
  );
}

function StandardCard({
  market,
  tradeHref,
  locale,
  tc,
  animating,
}: {
  market: CarouselMarket;
  tradeHref: string;
  locale: Locale;
  tc: T["carousel"];
  animating: boolean;
}) {
  return (
    <div
      className="rounded-2xl bg-slate-900 p-5 text-white transition-opacity duration-200"
      style={{ opacity: animating ? 0 : 1 }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-bold tracking-wide text-slate-300">
          {market.assetSymbol}
        </span>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          <span>{tc.closes} {formatCloseDate(market.closeAt, locale)}</span>
        </div>
      </div>

      <p className="mt-3 min-h-[2.5rem] text-sm font-semibold leading-snug text-white line-clamp-2">
        {locale === "zh" && market.titleZh ? market.titleZh : market.title}
      </p>

      {market.yesPrice != null && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${Math.min(100, parseFloat(market.yesPrice) * 100)}%` }}
          />
        </div>
      )}

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
  );
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
    const id = setInterval(next, 5000);
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
  const isShortDuration = market.durationMinutes != null;

  return (
    <div>
      {isShortDuration ? (
        <ShortDurationCard market={market} tradeHref={tradeHref} locale={locale} tc={tc} />
      ) : (
        <StandardCard
          market={market}
          tradeHref={tradeHref}
          locale={locale}
          tc={tc}
          animating={animating}
        />
      )}

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
