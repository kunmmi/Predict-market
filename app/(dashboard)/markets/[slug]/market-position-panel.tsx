"use client";

import { useCallback, useEffect, useState } from "react";
import { useVisibilityPoll } from "@/lib/hooks/use-visibility-poll";
import type { Locale } from "@/lib/i18n/translations";

type Position = {
  hasPosition: false;
} | {
  hasPosition: true;
  yesUnits: number;
  noUnits: number;
  avgYesPrice: number | null;
  avgNoPrice: number | null;
};

type Props = {
  marketId: string;
  isShortDuration: boolean;
  locale: Locale;
  /** Bump this number to force an immediate refetch (e.g. after placing a trade). */
  refreshTick?: number;
};

export function MarketPositionPanel({ marketId, isShortDuration, locale, refreshTick }: Props) {
  const [position, setPosition] = useState<Position | null>(null);

  const zh = locale === "zh";

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/my-position`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setPosition(json as Position);
    } catch {
      // silently swallow — non-critical UI
    }
  }, [marketId]);

  // Initial fetch
  useEffect(() => { void fetch_(); }, [fetch_]);

  // Refetch whenever parent increments refreshTick (i.e. trade just placed)
  useEffect(() => {
    if (refreshTick == null || refreshTick === 0) return;
    void fetch_();
  }, [refreshTick, fetch_]);

  // Background poll every 5s, pauses when tab hidden
  useVisibilityPoll(fetch_, 5_000);

  if (!position || !position.hasPosition) return null;

  const { yesUnits, noUnits, avgYesPrice, avgNoPrice } = position;

  const hasYes = yesUnits > 0.0001;
  const hasNo  = noUnits  > 0.0001;

  // Each unit pays $1 if that side wins
  const upPayout   = hasYes ? yesUnits.toFixed(2) : null;
  const downPayout = hasNo  ? noUnits.toFixed(2)  : null;

  const upLabel   = isShortDuration ? (zh ? "看涨 (UP)"   : "UP")   : (zh ? "是" : "YES");
  const downLabel = isShortDuration ? (zh ? "看跌 (DOWN)" : "DOWN") : (zh ? "否" : "NO");

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {zh ? "我的持仓" : "Your Position"}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {hasYes && (
          <div className="rounded-lg border border-green-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                {upLabel}
              </span>
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                {zh ? "持有中" : "Open"}
              </span>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
              {yesUnits.toFixed(4)} {zh ? "份" : "units"}
            </p>
            <div className="mt-1 flex items-baseline gap-2 text-xs text-slate-500">
              {avgYesPrice != null && (
                <span>{zh ? "均价" : "Avg entry"} ${avgYesPrice.toFixed(3)}</span>
              )}
              <span className="ml-auto font-semibold text-green-600">
                {zh ? "若赢得" : "To win"} ${upPayout}
              </span>
            </div>
          </div>
        )}

        {hasNo && (
          <div className="rounded-lg border border-red-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
                {downLabel}
              </span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                {zh ? "持有中" : "Open"}
              </span>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
              {noUnits.toFixed(4)} {zh ? "份" : "units"}
            </p>
            <div className="mt-1 flex items-baseline gap-2 text-xs text-slate-500">
              {avgNoPrice != null && (
                <span>{zh ? "均价" : "Avg entry"} ${avgNoPrice.toFixed(3)}</span>
              )}
              <span className="ml-auto font-semibold text-red-500">
                {zh ? "若赢得" : "To win"} ${downPayout}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
