"use client";

import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVisibilityPoll } from "@/lib/hooks/use-visibility-poll";
import type { OrderBookLevel, OrderBookResponse } from "@/app/api/markets/[id]/order-book/route";

const MIN_ORDERS_TO_SHOW = 3;
const MAX_LEVELS = 8;

type Props = {
  marketId: string;
  currentPrice: number | null;
  isShortDuration: boolean;
  locale: string;
};

function DepthBar({ value, max, side }: { value: number; max: number; side: "yes" | "no" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="absolute inset-y-0 w-full overflow-hidden rounded-sm">
      <div
        className={`absolute inset-y-0 transition-all duration-300 ${
          side === "yes" ? "right-0 bg-green-500/10" : "left-0 bg-red-400/10"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function LevelRow({
  level,
  max,
  side,
  isCrossed,
}: {
  level: OrderBookLevel;
  max: number;
  side: "yes" | "no";
  isCrossed: boolean;
}) {
  return (
    <div
      className={`relative grid grid-cols-3 items-center gap-x-2 rounded-sm px-2 py-[5px] text-xs ${
        isCrossed ? "opacity-40" : ""
      }`}
    >
      <DepthBar value={level.totalStake} max={max} side={side} />
      {side === "yes" ? (
        <>
          <span className="relative text-right font-mono tabular-nums text-slate-500">
            {level.orderCount}
          </span>
          <span className="relative text-right font-mono tabular-nums text-slate-700">
            ${level.totalStake.toFixed(0)}
          </span>
          <span className="relative text-right font-semibold tabular-nums text-green-700">
            {(level.price * 100).toFixed(1)}¢
          </span>
        </>
      ) : (
        <>
          <span className="relative text-left font-semibold tabular-nums text-red-600">
            {(level.price * 100).toFixed(1)}¢
          </span>
          <span className="relative text-left font-mono tabular-nums text-slate-700">
            ${level.totalStake.toFixed(0)}
          </span>
          <span className="relative text-left font-mono tabular-nums text-slate-500">
            {level.orderCount}
          </span>
        </>
      )}
    </div>
  );
}

export function OrderBookPanel({ marketId, currentPrice, isShortDuration, locale }: Props) {
  const [book, setBook] = useState<OrderBookResponse | null>(null);

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/order-book`);
      if (!res.ok) return;
      const data = (await res.json()) as OrderBookResponse;
      setBook(data);
    } catch {
      // silent
    }
  }, [marketId]);

  useEffect(() => { void fetchBook(); }, [fetchBook]);
  useVisibilityPoll(fetchBook, 20_000);

  if (!book || book.totalOrders < MIN_ORDERS_TO_SHOW) return null;

  const yesLevels = book.yes.slice(0, MAX_LEVELS);
  const noLevels = book.no.slice(0, MAX_LEVELS);

  const maxStake = Math.max(
    ...yesLevels.map((l) => l.totalStake),
    ...noLevels.map((l) => l.totalStake),
    1,
  );

  const upLabel = isShortDuration ? (locale === "zh" ? "看涨" : "UP") : (locale === "zh" ? "看涨" : "YES");
  const downLabel = isShortDuration ? (locale === "zh" ? "看跌" : "DOWN") : (locale === "zh" ? "看跌" : "NO");
  const title = locale === "zh" ? "挂单簿" : "Order Book";
  const spreadLabel = locale === "zh" ? "当前价格" : "Live price";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {title}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {book.totalOrders}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4">
        <div className="grid grid-cols-2 gap-x-3">
          {/* YES / UP side */}
          <div>
            <div className="mb-1 grid grid-cols-3 gap-x-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="text-right">#</span>
              <span className="text-right">Stake</span>
              <span className="text-right text-green-600">{upLabel}</span>
            </div>
            <div className="space-y-px">
              {yesLevels.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-slate-400">—</p>
              ) : (
                yesLevels.map((level) => (
                  <LevelRow
                    key={level.price}
                    level={level}
                    max={maxStake}
                    side="yes"
                    isCrossed={currentPrice != null && level.price >= currentPrice}
                  />
                ))
              )}
            </div>
          </div>

          {/* NO / DOWN side */}
          <div>
            <div className="mb-1 grid grid-cols-3 gap-x-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="text-left text-red-500">{downLabel}</span>
              <span className="text-left">Stake</span>
              <span className="text-left">#</span>
            </div>
            <div className="space-y-px">
              {noLevels.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-slate-400">—</p>
              ) : (
                noLevels.map((level) => (
                  <LevelRow
                    key={level.price}
                    level={level}
                    max={maxStake}
                    side="no"
                    isCrossed={currentPrice != null && level.price >= currentPrice}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {currentPrice != null && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-[11px] text-slate-400">{spreadLabel}</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
              {(currentPrice * 100).toFixed(1)}¢
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
