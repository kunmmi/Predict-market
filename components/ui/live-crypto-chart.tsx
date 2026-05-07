"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { Activity, ArrowDownRight, ArrowUpRight, Minus, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { cn } from "@/lib/helpers/cn";
import { useBinanceKlineStream } from "@/lib/hooks/use-binance-kline-stream";
import { useFiveMinuteRound } from "@/lib/hooks/use-five-minute-round";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketCountdown } from "@/app/(dashboard)/markets/[slug]/market-countdown";

type Labels = {
  title: string;
  subtitle: string;
  currentPrice: string;
  openingPrice: string;
  priceDifference: string;
  roundResult: string;
  countdown: string;
  priceToBeat: string;
  reconnect: string;
  loading: string;
  disconnected: string;
  reconnecting: string;
  connected: string;
  waiting: string;
  up: string;
  down: string;
  flat: string;
};

type LiveCryptoChartProps = {
  marketId?: string;
  marketSlug?: string;
  assetSymbol: string;
  closeAt?: string | null;
  durationMinutes?: number | null;
  spotPriceAtOpen?: string | number | null;
  className?: string;
  labels?: Partial<Labels>;
  settleLabels?: {
    countdownClosesIn: string;
    countdownExpired: string;
    shortDurationBadge: string;
  };
};

const defaultLabels: Labels = {
  title: "5-Minute Live Price",
  subtitle: "Frontend demo round with Binance live candles",
  currentPrice: "Current price",
  openingPrice: "Opening price",
  priceDifference: "Price difference",
  roundResult: "Round result",
  countdown: "Countdown",
  priceToBeat: "Price to beat",
  reconnect: "Reconnect",
  loading: "Loading",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting",
  connected: "Connected",
  waiting: "Waiting for live Binance candles.",
  up: "UP",
  down: "DOWN",
  flat: "FLAT",
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function directionLabel(direction: "up" | "down" | "flat", labels: Labels) {
  if (direction === "up") return labels.up;
  if (direction === "down") return labels.down;
  return labels.flat;
}

function statusLabel(status: "loading" | "connected" | "disconnected" | "reconnecting", labels: Labels) {
  if (status === "connected") return labels.connected;
  if (status === "reconnecting") return labels.reconnecting;
  if (status === "disconnected") return labels.disconnected;
  return labels.loading;
}

export default function LiveCryptoChart({
  marketId,
  marketSlug,
  assetSymbol,
  className,
  closeAt,
  durationMinutes,
  spotPriceAtOpen,
  labels: labelsProp,
  settleLabels,
}: LiveCryptoChartProps) {
  const router = useRouter();
  const labels = { ...defaultLabels, ...labelsProp };
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const hasSeededRef = useRef(false);
  const binanceSymbol = ASSET_TO_BINANCE[assetSymbol] ?? null;
  const parsedReferencePrice =
    spotPriceAtOpen == null ? null : Number(spotPriceAtOpen);
  const referencePrice = Number.isFinite(parsedReferencePrice) ? parsedReferencePrice : null;

  const { candles, currentPrice, error, latestCandle, reconnect, seedVersion, status } =
    useBinanceKlineStream(binanceSymbol, {
      interval: "1m",
      limit: 180,
    });

  const round = useFiveMinuteRound({
    currentPrice,
    durationMinutes,
    initialReferencePrice: referencePrice,
    initialRoundEndAt: closeAt ?? null,
  });

  const [pulseDirection, setPulseDirection] = useState<"up" | "down" | null>(null);
  const [settling, setSettling] = useState(false);
  const previousPriceRef = useRef<number | null>(null);
  const hasData = candles.length > 0;

  const handleExpired = useCallback(() => {
    if (!marketId || !marketSlug || settling) return;

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
        setSettling(false);
      });
  }, [marketId, marketSlug, router, settling]);

  useEffect(() => {
    if (currentPrice == null) return;

    const previousPrice = previousPriceRef.current;
    previousPriceRef.current = currentPrice;
    if (previousPrice == null || previousPrice === currentPrice) return;

    setPulseDirection(currentPrice > previousPrice ? "up" : "down");
    const timeout = window.setTimeout(() => setPulseDirection(null), 520);
    return () => window.clearTimeout(timeout);
  }, [currentPrice]);

  const tone = useMemo(() => {
    if (round.liveDirection === "up") {
      return {
        accent: "#10b981",
        glow: "shadow-[0_18px_45px_-28px_rgba(16,185,129,0.28)]",
        text: "text-emerald-600",
        mutedText: "text-emerald-600/80",
        badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        line: "rgba(16, 185, 129, 0.9)",
      };
    }

    if (round.liveDirection === "down") {
      return {
        accent: "#f43f5e",
        glow: "shadow-[0_18px_45px_-28px_rgba(244,63,94,0.24)]",
        text: "text-rose-600",
        mutedText: "text-rose-600/80",
        badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
        line: "rgba(244, 63, 94, 0.9)",
      };
    }

    return {
      accent: "#3b82f6",
      glow: "shadow-[0_18px_45px_-28px_rgba(59,130,246,0.22)]",
      text: "text-sky-600",
      mutedText: "text-sky-700/80",
      badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
      line: "rgba(59, 130, 246, 0.88)",
    };
  }, [round.liveDirection]);

  useEffect(() => {
    if (!hasData) return;

    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(51, 65, 85, 0.92)",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.12)" },
        horzLines: { color: "rgba(148, 163, 184, 0.12)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(100, 116, 139, 0.24)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "rgba(255, 255, 255, 0.96)",
        },
        horzLine: {
          color: "rgba(100, 116, 139, 0.24)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "rgba(255, 255, 255, 0.96)",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
        scaleMargins: { top: 0.18, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 18,
        minBarSpacing: 8,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        pinch: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb7185",
      borderUpColor: "#34d399",
      borderDownColor: "#fb7185",
      wickUpColor: "#6ee7b7",
      wickDownColor: "#fda4af",
      lastValueVisible: true,
      priceLineVisible: true,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
      chart.timeScale().scrollToRealTime();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (priceLineRef.current) {
        series.removePriceLine(priceLineRef.current);
        priceLineRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      hasSeededRef.current = false;
    };
  }, [hasData]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || candles.length === 0) return;

    series.setData(candles);
    chart?.timeScale().fitContent();
    chart?.timeScale().scrollToRealTime();
    hasSeededRef.current = true;
  }, [candles, seedVersion]);

  useEffect(() => {
    if (!hasSeededRef.current || !latestCandle || !seriesRef.current) return;

    seriesRef.current.update(latestCandle);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [latestCandle]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.applyOptions({
      priceFormat: {
        type: "price",
        precision: currentPrice != null && currentPrice < 10 ? 4 : 2,
        minMove: currentPrice != null && currentPrice < 10 ? 0.0001 : 0.01,
      },
    });
  }, [currentPrice]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (priceLineRef.current) {
      series.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    if (round.openingPrice == null) return;

    priceLineRef.current = series.createPriceLine({
      price: round.openingPrice,
      color: tone.line,
      lineWidth: 1,
      lineStyle: LineStyle.LargeDashed,
      axisLabelVisible: true,
      title: labels.priceToBeat,
    });
  }, [labels.priceToBeat, round.openingPrice, tone.line]);

  return (
    <Card
      className={cn(
        "overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(248,250,252,1))] text-slate-900",
        tone.glow,
        className,
      )}
    >
      <CardContent className="p-0">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-slate-100 text-slate-700 ring-1 ring-slate-200">{assetSymbol}</Badge>
                {settleLabels ? <Badge>{settleLabels.shortDurationBadge}</Badge> : null}
                <Badge className={tone.badge}>{directionLabel(round.liveDirection, labels)}</Badge>
                <Badge
                  className={cn(
                    "gap-1.5 bg-slate-100 text-slate-700 ring-1 ring-slate-200",
                    status === "connected" && "bg-emerald-50 text-emerald-700 ring-emerald-200",
                    status === "reconnecting" && "bg-amber-50 text-amber-700 ring-amber-200",
                    status === "disconnected" && "bg-rose-50 text-rose-700 ring-rose-200",
                  )}
                >
                  {status === "connected" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {statusLabel(status, labels)}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">{labels.title}</p>
                <p className="mt-1 text-sm text-slate-500">{labels.subtitle}</p>
                {closeAt && settleLabels ? (
                  <div className="mt-2 text-sm text-slate-600">
                    <MarketCountdown
                      closeAt={closeAt}
                      t={{
                        countdown_closes_in: settleLabels.countdownClosesIn,
                        countdown_expired: settling
                          ? `${settleLabels.countdownExpired}...`
                          : settleLabels.countdownExpired,
                      }}
                      onExpired={handleExpired}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 transition-all duration-500",
                    pulseDirection === "up" && "bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.18)]",
                    pulseDirection === "down" && "bg-rose-400/10 shadow-[0_0_0_1px_rgba(251,113,133,0.18)]",
                  )}
                >
                  <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
                    {labels.currentPrice}
                  </div>
                  <div className={cn("mt-1 text-3xl font-semibold tabular-nums sm:text-4xl", tone.text)}>
                    {currentPrice != null ? `$${priceFormatter.format(currentPrice)}` : "--"}
                  </div>
                </div>
                <div className="pb-2">
                  <div className={cn("flex items-center gap-1.5 text-sm font-medium", tone.mutedText)}>
                    {round.liveDirection === "up" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : round.liveDirection === "down" ? (
                      <ArrowDownRight className="h-4 w-4" />
                    ) : (
                      <Minus className="h-4 w-4" />
                    )}
                    {round.percentageChange != null
                      ? `${round.percentageChange >= 0 ? "+" : ""}${round.percentageChange.toFixed(2)}%`
                      : "--"}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{labels.openingPrice}</div>
                <div className="mt-2 text-sm font-semibold tabular-nums text-slate-900">
                  {round.openingPrice != null ? `$${priceFormatter.format(round.openingPrice)}` : "--"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{labels.priceDifference}</div>
                <div className={cn("mt-2 text-sm font-semibold tabular-nums", tone.text)}>
                  {round.priceDifference != null
                    ? `${round.priceDifference >= 0 ? "+" : ""}$${priceFormatter.format(round.priceDifference)}`
                    : "--"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{labels.countdown}</div>
                <div className="mt-2 flex items-center gap-2 text-sm font-semibold tabular-nums text-slate-900">
                  <Activity className="h-4 w-4 text-slate-500" />
                  {round.countdownMs == null ? "--:--" : formatCountdown(round.countdownMs)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{labels.roundResult}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {directionLabel(round.lastResult ?? round.liveDirection, labels)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-100/80 to-transparent" />

            {!hasData ? (
              <div className="flex h-[280px] animate-pulse flex-col justify-between p-4 sm:h-[360px] lg:h-[420px]">
                <div className="h-5 w-36 rounded-full bg-slate-200" />
                <div className="space-y-3">
                  <div className="h-4 w-full rounded-full bg-slate-100" />
                  <div className="h-4 w-5/6 rounded-full bg-slate-100" />
                  <div className="h-4 w-4/6 rounded-full bg-slate-100" />
                </div>
                <div className="text-sm text-slate-500">{labels.waiting}</div>
              </div>
            ) : (
              <div className="relative">
                <div ref={containerRef} className="h-[280px] w-full sm:h-[360px] lg:h-[420px]" />
                <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between gap-3">
                  <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] text-slate-600 shadow-sm backdrop-blur">
                    {labels.priceToBeat}: {round.openingPrice != null ? `$${priceFormatter.format(round.openingPrice)}` : "--"}
                  </div>
                  {pulseDirection ? (
                    <div
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.18em] backdrop-blur",
                        pulseDirection === "up" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                      )}
                    >
                      Live move
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {(status === "disconnected" || status === "reconnecting" || error) && (
            <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-slate-900">
                  {status === "reconnecting" ? labels.reconnecting : labels.disconnected}
                </div>
                <div className="mt-1 text-slate-500">
                  {error ?? "The live stream dropped. You can reconnect without reloading the page."}
                </div>
              </div>
              <Button
                variant="secondary"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={reconnect}
              >
                <RefreshCw className="h-4 w-4" />
                {labels.reconnect}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
