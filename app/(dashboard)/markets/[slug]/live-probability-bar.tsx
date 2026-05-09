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
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="bg-green-500 transition-all duration-500" style={{ width: `${upPct}%` }} />
        <div className="bg-red-400 transition-all duration-500" style={{ width: `${downPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span className="font-medium text-green-600">{upPct.toFixed(1)}% {upLabel}</span>
        <span className="font-medium text-red-500">{downPct.toFixed(1)}% {downLabel}</span>
      </div>
    </div>
  );
}
