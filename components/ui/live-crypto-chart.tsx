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

  const [seriesReady, setSeriesReady] = useState(false);
  const [pulseDirection, setPulseDirection] = useState<"up" | "down" | null>(null);
  const [settling, setSettling] = useState(false);
  const settlingRef = useRef(false);
  const retryCountRef = useRef(0);
  const previousPriceRef = useRef<number | null>(null);
  const hasData = candles.length > 0;

  const handleExpired = useCallback(() => {
    if (!marketId || !marketSlug || settlingRef.current) return;
    settlingRef.current = true;
    setSettling(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);

    void fetch(`/api/markets/${marketId}/auto-settle`, {
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as
          | { success?: boolean; nextMarketSlug?: string }
          | null;

        if (!response.ok || !json?.success) {
          // Settlement failed (e.g. Binance 502). Retry via server refresh up to 3 times.
          if (retryCountRef.current < 3) {
            retryCountRef.current += 1;
            setTimeout(() => {
              settlingRef.current = false;
              router.refresh();
            }, 5_000);
          }
          return;
        }

        retryCountRef.current = 0;

        // Wait 5 seconds before navigating so the win/loss result banner has
        // time to poll, display the outcome and new balance, and let the user
        // read it before the page moves to the next round.
        if (json.nextMarketSlug && json.nextMarketSlug !== marketSlug) {
          setTimeout(() => router.replace(`/markets/${json.nextMarketSlug}`), 5_000);
          return;
        }

        setTimeout(() => router.refresh(), 5_000);
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timeoutId);
        settlingRef.current = false;
        setSettling(false);
        if (controller.signal.aborted) setTimeout(() => router.refresh(), 5_000);
      });
  }, [marketId, marketSlug, router]);

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
        accent: "var(--teal)",
        accentRaw: "#0DB891",
        glow: "shadow-[0_18px_45px_-28px_rgba(13,184,145,0.25)]",
        color: "var(--teal)",
        badge: "bg-[var(--teal-dim)] text-[var(--teal)] ring-1 ring-[rgba(13,184,145,0.25)]",
        line: "rgba(13,184,145,0.9)",
      };
    }

    if (round.liveDirection === "down") {
      return {
        accent: "var(--rose)",
        accentRaw: "#E8445A",
        glow: "shadow-[0_18px_45px_-28px_rgba(232,68,90,0.22)]",
        color: "var(--rose)",
        badge: "bg-[var(--rose-dim)] text-[var(--rose)] ring-1 ring-[rgba(232,68,90,0.25)]",
        line: "rgba(232,68,90,0.9)",
      };
    }

    return {
      accent: "var(--gold)",
      accentRaw: "#E8A020",
      glow: "shadow-[0_18px_45px_-28px_rgba(232,160,32,0.18)]",
      color: "var(--gold)",
      badge: "bg-[var(--gold-dim)] text-[var(--gold)] ring-1 ring-[var(--border-gold)]",
      line: "rgba(232,160,32,0.85)",
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
        textColor: "rgba(160, 170, 180, 0.9)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(232,160,32,0.3)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "rgba(20,22,24,0.96)",
        },
        horzLine: {
          color: "rgba(232,160,32,0.3)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "rgba(20,22,24,0.96)",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.18, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
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
    setSeriesReady(true);

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
      setSeriesReady(false);
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
  }, [labels.priceToBeat, round.openingPrice, seriesReady, tone.line]);

  return (
    <Card
      className={cn("overflow-hidden", tone.glow, className)}
    >
      <CardContent className="p-0">
        <div style={{ borderBottom: "1px solid var(--border-subtle)", padding: "16px 20px" }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <Badge className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]">{assetSymbol}</Badge>
                {settleLabels ? <Badge>{settleLabels.shortDurationBadge}</Badge> : null}
                <Badge className={tone.badge}>{directionLabel(round.liveDirection, labels)}</Badge>
                <Badge
                  className={cn(
                    "gap-1.5 bg-[var(--bg-elevated)] text-[var(--text-dim)] ring-1 ring-[var(--border-subtle)]",
                    status === "connected" && "bg-[var(--teal-dim)] text-[var(--teal)] ring-[rgba(13,184,145,0.25)]",
                    status === "reconnecting" && "bg-[var(--gold-dim)] text-[var(--gold)] ring-[var(--border-gold)]",
                    status === "disconnected" && "bg-[var(--rose-dim)] text-[var(--rose)] ring-[rgba(232,68,90,0.25)]",
                  )}
                >
                  {status === "connected" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {statusLabel(status, labels)}
                </Badge>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-dim)" }}>{labels.title}</p>
                <p style={{ marginTop: 2, fontSize: "0.875rem", color: "var(--text-dim)" }}>{labels.subtitle}</p>
                {closeAt && settleLabels ? (
                  <div style={{ marginTop: 6, fontSize: "0.875rem", color: "var(--text-secondary)" }}>
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
                  style={{
                    borderRadius: 16,
                    padding: "8px 12px",
                    transition: "background-color 500ms ease, box-shadow 500ms ease",
                    ...(pulseDirection === "up" && { backgroundColor: "rgba(13,184,145,0.08)", boxShadow: "0 0 0 1px rgba(13,184,145,0.18)" }),
                    ...(pulseDirection === "down" && { backgroundColor: "rgba(232,68,90,0.08)", boxShadow: "0 0 0 1px rgba(232,68,90,0.18)" }),
                  }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.24em", color: "var(--text-dim)" }}>
                    {labels.currentPrice}
                  </div>
                  <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 600, color: tone.color, fontVariantNumeric: "tabular-nums" }}>
                    {currentPrice != null ? `$${priceFormatter.format(currentPrice)}` : "--"}
                  </div>
                </div>
                <div style={{ paddingBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem", fontWeight: 500, color: tone.color, opacity: 0.8 }}>
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
              <div style={{ borderRadius: 12, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-elevated)", padding: "10px 12px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.22em", color: "var(--text-dim)" }}>{labels.openingPrice}</div>
                <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                  {round.openingPrice != null ? `$${priceFormatter.format(round.openingPrice)}` : "--"}
                </div>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-elevated)", padding: "10px 12px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.22em", color: "var(--text-dim)" }}>{labels.priceDifference}</div>
                <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: tone.color }}>
                  {round.priceDifference != null
                    ? `${round.priceDifference >= 0 ? "+" : ""}$${priceFormatter.format(round.priceDifference)}`
                    : "--"}
                </div>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-elevated)", padding: "10px 12px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.22em", color: "var(--text-dim)" }}>{labels.countdown}</div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                  <Activity className="h-4 w-4" style={{ color: "var(--text-dim)" }} />
                  {round.countdownMs == null ? "--:--" : formatCountdown(round.countdownMs)}
                </div>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-elevated)", padding: "10px 12px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.22em", color: "var(--text-dim)" }}>{labels.roundResult}</div>
                <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 600, color: tone.color }}>
                  {directionLabel(round.lastResult ?? round.liveDirection, labels)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 20, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-elevated)" }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.03), transparent)" }} />

            {!hasData ? (
              <div className="flex h-[280px] animate-pulse flex-col justify-between p-4 sm:h-[360px] lg:h-[420px]">
                <div style={{ height: 20, width: 144, borderRadius: 9999, backgroundColor: "var(--border-subtle)" }} />
                <div className="space-y-3">
                  <div style={{ height: 16, width: "100%", borderRadius: 9999, backgroundColor: "var(--bg-surface)" }} />
                  <div style={{ height: 16, width: "83.333%", borderRadius: 9999, backgroundColor: "var(--bg-surface)" }} />
                  <div style={{ height: 16, width: "66.667%", borderRadius: 9999, backgroundColor: "var(--bg-surface)" }} />
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--text-dim)" }}>{labels.waiting}</div>
              </div>
            ) : (
              <div className="relative">
                <div ref={containerRef} className="h-[280px] w-full sm:h-[360px] lg:h-[420px]" />
                <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between gap-3">
                  <div style={{ borderRadius: 9999, border: "1px solid var(--border-subtle)", backgroundColor: "rgba(7,8,9,0.85)", backdropFilter: "blur(12px)", padding: "5px 12px", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500, letterSpacing: "0.18em", color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
                    {labels.priceToBeat}: {round.openingPrice != null ? `$${priceFormatter.format(round.openingPrice)}` : "--"}
                  </div>
                  {pulseDirection ? (
                    <div
                      style={{
                        borderRadius: 9999,
                        padding: "4px 10px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        fontWeight: 500,
                        letterSpacing: "0.18em",
                        backdropFilter: "blur(12px)",
                        ...(pulseDirection === "up"
                          ? { backgroundColor: "var(--teal-dim)", color: "var(--teal)" }
                          : { backgroundColor: "var(--rose-dim)", color: "var(--rose)" }),
                      }}
                    >
                      Live move
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {(status === "disconnected" || status === "reconnecting" || error) && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12, borderRadius: 16, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)", padding: "12px 16px", fontSize: "0.875rem", color: "var(--text-secondary)" }} className="sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                  {status === "reconnecting" ? labels.reconnecting : labels.disconnected}
                </div>
                <div style={{ marginTop: 4, color: "var(--text-dim)" }}>
                  {error ?? "The live stream dropped. You can reconnect without reloading the page."}
                </div>
              </div>
              <Button
                variant="secondary"
                style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
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
