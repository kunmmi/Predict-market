"use client";

import { useMemo, useState, useEffect } from "react";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { useBinanceKlineStream } from "@/lib/hooks/use-binance-kline-stream";
import { computeBinaryYesPrice } from "@/lib/short-duration-predictions";

type Props = {
  assetSymbol: string;
  spotPriceAtOpen: string | null;
  closeAt: string;
  upLabel: string;
  downLabel: string;
  fallbackYesPrice: string | null;
};

export function LiveProbabilityBar({
  assetSymbol,
  spotPriceAtOpen,
  closeAt,
  upLabel,
  downLabel,
  fallbackYesPrice,
}: Props) {
  const binanceSymbol = ASSET_TO_BINANCE[assetSymbol] ?? null;
  const { currentPrice, candles } = useBinanceKlineStream(binanceSymbol);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const yesProb = useMemo(() => {
    if (currentPrice == null || spotPriceAtOpen == null || now == null) {
      return fallbackYesPrice != null ? parseFloat(fallbackYesPrice) : 0.5;
    }
    const secondsRemaining = Math.max(0, Math.floor((new Date(closeAt).getTime() - now) / 1000));
    return computeBinaryYesPrice({
      currentSpotPrice: currentPrice,
      openingSpotPrice: Number(spotPriceAtOpen),
      secondsRemaining,
      recentCandles: candles,
    });
  }, [currentPrice, spotPriceAtOpen, now, closeAt, candles, fallbackYesPrice]);

  const upPct = Math.min(100, Math.max(0, yesProb * 100));
  const downPct = 100 - upPct;

  return (
    <div className="space-y-1.5">
      {/* Use scaleX transform (not width) — only transform & opacity for movement */}
      <div
        style={{
          position: "relative",
          height: 8,
          width: "100%",
          overflow: "hidden",
          borderRadius: 9999,
          backgroundColor: "var(--rose-dim)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "left",
            transform: `scaleX(${upPct / 100})`,
            transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
            backgroundColor: "var(--teal)",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
        <span style={{ fontWeight: 500, color: "var(--teal)" }}>{upPct.toFixed(1)}% {upLabel}</span>
        <span style={{ fontWeight: 500, color: "var(--rose)" }}>{downPct.toFixed(1)}% {downLabel}</span>
      </div>
    </div>
  );
}
