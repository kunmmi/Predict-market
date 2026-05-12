"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { useBinancePrice } from "@/lib/hooks/use-binance-price";
import { MarketCountdown } from "./market-countdown";

type Props = {
  marketId: string;
  marketSlug: string;
  assetSymbol: string;
  closeAt: string;
  durationMinutes: number | null;
  isShortDuration: boolean;
  spotPriceAtOpen: string | null;
  t: {
    live_price: string;
    countdown_closes_in: string;
    countdown_expired: string;
    short_duration_badge: string;
    target_price_label: string;
  };
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type PricePoint = {
  price: number;
  timestamp: number;
};

type ChartPoint = {
  x: number;
  y: number;
};

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  let path = `M ${points[0]!.x} ${points[0]!.y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i]!;
    const next = points[i + 1]!;
    const controlX = (current.x + next.x) / 2;

    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

function buildAreaPath(linePath: string, lastX: number, height: number): string {
  if (!linePath) return "";
  return `${linePath} L ${lastX} ${height} L 0 ${height} Z`;
}

function samplePoints<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;

  const step = (points.length - 1) / (maxPoints - 1);
  const sampled: T[] = [];

  for (let i = 0; i < maxPoints; i += 1) {
    sampled.push(points[Math.round(i * step)]!);
  }

  return sampled;
}

export function LivePriceTicker({
  marketId,
  marketSlug,
  assetSymbol,
  closeAt,
  durationMinutes,
  isShortDuration,
  spotPriceAtOpen,
  t,
}: Props) {
  const router = useRouter();
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const [settling, setSettling] = useState(false);
  const settlingRef = useRef(false);
  const [recentPrices, setRecentPrices] = useState<PricePoint[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const binanceSymbol = isShortDuration ? (ASSET_TO_BINANCE[assetSymbol] ?? null) : null;
  const { price, prevPrice } = useBinancePrice(binanceSymbol);
  const closeAtMs = useMemo(() => new Date(closeAt).getTime(), [closeAt]);
  const durationMs = useMemo(() => (durationMinutes ?? 5) * 60_000, [durationMinutes]);
  const marketOpenAtMs = useMemo(() => closeAtMs - durationMs, [closeAtMs, durationMs]);
  const spotPriceAtOpenNumber = useMemo(
    () => (spotPriceAtOpen != null ? Number(spotPriceAtOpen) : null),
    [spotPriceAtOpen],
  );

  // Refresh server data when tab regains visibility (e.g. after laptop wake).
  // This ensures closeAt is up-to-date before MarketCountdown fires onExpired.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  useEffect(() => {
    let frameId = 0;
    let lastPaint = 0;

    const tick = (now: number) => {
      if (now - lastPaint >= 33) {
        lastPaint = now;
        setCurrentTime(now);
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (price == null || prevPrice == null || price === prevPrice) return;

    setDirection(price > prevPrice ? "up" : "down");
    const timeoutId = setTimeout(() => setDirection(null), 800);
    return () => clearTimeout(timeoutId);
  }, [price, prevPrice]);

  useEffect(() => {
    if (price == null) return;

    setRecentPrices((prev) => {
      const now = Date.now();
      const nextPoint = { price, timestamp: now };
      const marketWindowStartMs = now - durationMs;
      const filtered = prev.filter((point) => point.timestamp >= marketWindowStartMs);
      const lastPoint = filtered[filtered.length - 1];

      if (lastPoint && lastPoint.price === price) {
        return filtered;
      }

      return [...filtered, nextPoint].slice(-120);
    });
  }, [durationMs, price]);

  const handleExpired = useCallback(() => {
    // Use a ref instead of the `settling` state so this callback's reference
    // stays stable. If `settling` were in the deps, every toggle would produce
    // a new function → MarketCountdown's useEffect would re-run → firedRef
    // would reset → onExpired fires again → infinite loop.
    if (settlingRef.current) return;
    settlingRef.current = true;
    setSettling(true);

    void fetch(`/api/markets/${marketId}/auto-settle`, {
      method: "POST",
    })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as
          | { success?: boolean; nextMarketSlug?: string }
          | null;

        if (!response.ok || !json?.success) return;

        if (json.nextMarketSlug && json.nextMarketSlug !== marketSlug) {
          router.replace(`/markets/${json.nextMarketSlug}`);
          return;
        }

        router.refresh();
      })
      .catch(() => undefined)
      .finally(() => {
        settlingRef.current = false;
        setSettling(false);
      });
  }, [marketId, marketSlug, router]);

  const priceClassName = useMemo(() => {
    if (direction === "up") return "text-green-500";
    if (direction === "down") return "text-red-500";
    return "text-slate-800";
  }, [direction]);

  const sparkline = useMemo(() => {
    if (price == null && recentPrices.length < 2) return null;

    const width = 320;
    const height = 72;
    const windowStartMs = currentTime - durationMs;
    const visiblePrices = recentPrices.filter((point) => point.timestamp >= windowStartMs);
    const seededPrices = [...visiblePrices];

    if (spotPriceAtOpenNumber != null) {
      seededPrices.unshift({
        price: spotPriceAtOpenNumber,
        timestamp: Math.max(marketOpenAtMs, windowStartMs),
      });
    }

    if (price != null) {
      seededPrices.push({ price, timestamp: currentTime });
    }

    const dedupedPrices = seededPrices.filter((point, index, all) => {
      if (index === 0) return true;
      const prevPoint = all[index - 1]!;
      return prevPoint.timestamp !== point.timestamp || prevPoint.price !== point.price;
    });

    if (dedupedPrices.length < 2) return null;

    const sampledPrices = samplePoints(dedupedPrices, 42);
    const minPrice = Math.min(...sampledPrices.map((point) => point.price));
    const maxPrice = Math.max(...sampledPrices.map((point) => point.price));
    const range = maxPrice - minPrice || 1;

    const chartPoints: ChartPoint[] = sampledPrices.map((point) => {
      const normalizedTime = (point.timestamp - windowStartMs) / durationMs;
      const x = Math.min(width, Math.max(0, normalizedTime * width));
      const y = height - ((point.price - minPrice) / range) * height;
      return { x, y };
    });

    const linePath = buildSmoothPath(chartPoints);
    const lastX = chartPoints[chartPoints.length - 1]?.x ?? width;
    const areaPath = buildAreaPath(linePath, lastX, height);

    return {
      linePath,
      areaPath,
      width,
      height,
      minPrice,
      maxPrice,
      latestX: lastX,
      latestY: chartPoints[chartPoints.length - 1]?.y ?? height / 2,
    };
  }, [currentTime, durationMs, marketOpenAtMs, price, recentPrices, spotPriceAtOpenNumber]);

  const moveVsOpen = useMemo(() => {
    if (price == null || spotPriceAtOpenNumber == null) return null;
    return price - spotPriceAtOpenNumber;
  }, [price, spotPriceAtOpenNumber]);

  const chartTone = useMemo(() => {
    if (moveVsOpen == null) {
      return {
        stroke: "rgb(59 130 246)",
        glow: "rgb(191 219 254 / 0.55)",
        fillTop: "rgb(59 130 246 / 0.16)",
        fillMid: "rgb(96 165 250 / 0.07)",
      };
    }

    if (moveVsOpen >= 0) {
      return {
        stroke: "rgb(16 185 129)",
        glow: "rgb(167 243 208 / 0.5)",
        fillTop: "rgb(16 185 129 / 0.14)",
        fillMid: "rgb(110 231 183 / 0.06)",
      };
    }

    return {
      stroke: "rgb(244 114 182)",
      glow: "rgb(251 207 232 / 0.5)",
      fillTop: "rgb(244 114 182 / 0.14)",
      fillMid: "rgb(251 113 133 / 0.06)",
    };
  }, [moveVsOpen]);

  if (!isShortDuration) return null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge>{t.short_duration_badge}</Badge>
          <MarketCountdown
            closeAt={closeAt}
            t={{
              countdown_closes_in: t.countdown_closes_in,
              countdown_expired: settling ? `${t.countdown_expired}...` : t.countdown_expired,
            }}
            onExpired={handleExpired}
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.live_price}</p>
          <p className={`text-3xl font-bold tabular-nums transition-colors ${priceClassName}`}>
            {price != null ? `$${priceFormatter.format(price)}` : "-"}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Live movement</span>
            {moveVsOpen != null ? (
              <span className={moveVsOpen >= 0 ? "text-green-600" : "text-red-500"}>
                {moveVsOpen >= 0 ? "+" : ""}{priceFormatter.format(moveVsOpen)}
              </span>
            ) : null}
          </div>
          {sparkline ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <svg
                viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
                className="h-[72px] w-full overflow-visible"
                preserveAspectRatio="none"
                aria-label="Live price progression"
              >
                <defs>
                  <linearGradient id="live-price-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={chartTone.fillTop} />
                    <stop offset="65%" stopColor={chartTone.fillMid} />
                    <stop offset="100%" stopColor="rgb(255 255 255 / 0)" />
                  </linearGradient>
                  <linearGradient id="live-price-stroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor={chartTone.stroke} stopOpacity="0.24" />
                    <stop offset="55%" stopColor={chartTone.stroke} stopOpacity="0.72" />
                    <stop offset="100%" stopColor={chartTone.stroke} stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="live-price-headline" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={chartTone.stroke} stopOpacity="0.26" />
                    <stop offset="100%" stopColor={chartTone.stroke} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={sparkline.areaPath}
                  fill="url(#live-price-fill)"
                  opacity="0.95"
                />
                <path
                  d={sparkline.linePath}
                  fill="none"
                  stroke="url(#live-price-stroke)"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={sparkline.linePath}
                  fill="none"
                  stroke={chartTone.glow}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: "blur(3px)" }}
                  opacity="0.38"
                />
                <line
                  x1={sparkline.latestX}
                  x2={sparkline.latestX}
                  y1={sparkline.latestY}
                  y2={sparkline.height}
                  stroke="url(#live-price-headline)"
                  strokeWidth="1"
                  opacity="0.72"
                />
                <circle
                  cx={sparkline.latestX}
                  cy={sparkline.latestY}
                  r="4.25"
                  fill={chartTone.stroke}
                  opacity="0.14"
                />
                <circle
                  cx={sparkline.latestX}
                  cy={sparkline.latestY}
                  r="2.6"
                  fill="white"
                  stroke={chartTone.stroke}
                  strokeWidth="1.6"
                />
              </svg>
              <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>${priceFormatter.format(sparkline.minPrice)}</span>
                <span>${priceFormatter.format(sparkline.maxPrice)}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
              Waiting for live ticks…
            </div>
          )}
        </div>

        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-500">{t.target_price_label}</span>{" "}
          <span className="font-semibold tabular-nums text-slate-900">
            {spotPriceAtOpen != null ? `$${priceFormatter.format(Number(spotPriceAtOpen))}` : "-"}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
