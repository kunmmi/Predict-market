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
        style={{
          position: "absolute",
          insetBlock: 0,
          width: `${pct}%`,
          transition: "width 300ms ease",
          backgroundColor: side === "yes" ? "rgba(13,184,145,0.1)" : "rgba(232,68,90,0.1)",
          ...(side === "yes" ? { right: 0 } : { left: 0 }),
        }}
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
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        alignItems: "center",
        gap: "0 8px",
        borderRadius: 2,
        padding: "5px 8px",
        fontSize: "0.75rem",
        opacity: isCrossed ? 0.35 : 1,
      }}
    >
      <DepthBar value={level.totalStake} max={max} side={side} />
      {side === "yes" ? (
        <>
          <span style={{ position: "relative", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>{level.orderCount}</span>
          <span style={{ position: "relative", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>${level.totalStake.toFixed(0)}</span>
          <span style={{ position: "relative", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--teal)" }}>{(level.price * 100).toFixed(1)}¢</span>
        </>
      ) : (
        <>
          <span style={{ position: "relative", textAlign: "left", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--rose)" }}>{(level.price * 100).toFixed(1)}¢</span>
          <span style={{ position: "relative", textAlign: "left", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>${level.totalStake.toFixed(0)}</span>
          <span style={{ position: "relative", textAlign: "left", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>{level.orderCount}</span>
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
      <CardHeader style={{ paddingBottom: 8 }}>
        <CardTitle style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem" }}>
          {title}
          <span style={{ borderRadius: 100, backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", padding: "1px 8px", fontFamily: "var(--font-mono)", fontSize: "0.625rem", fontWeight: 600, color: "var(--text-dim)" }}>
            {book.totalOrders}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent style={{ padding: "0 12px 16px" }}>
        <div className="grid grid-cols-2 gap-x-3">
          {/* YES / UP side */}
          <div>
            <div style={{ marginBottom: 4, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 8px", padding: "0 8px", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
              <span style={{ textAlign: "right" }}>#</span>
              <span style={{ textAlign: "right" }}>Stake</span>
              <span style={{ textAlign: "right", color: "var(--teal)" }}>{upLabel}</span>
            </div>
            <div className="space-y-px">
              {yesLevels.length === 0 ? (
                <p style={{ padding: "12px 8px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-dim)" }}>—</p>
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
            <div style={{ marginBottom: 4, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 8px", padding: "0 8px", fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
              <span style={{ textAlign: "left", color: "var(--rose)" }}>{downLabel}</span>
              <span style={{ textAlign: "left" }}>Stake</span>
              <span style={{ textAlign: "left" }}>#</span>
            </div>
            <div className="space-y-px">
              {noLevels.length === 0 ? (
                <p style={{ padding: "12px 8px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-dim)" }}>—</p>
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
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-dim)", paddingTop: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)" }}>{spreadLabel}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {(currentPrice * 100).toFixed(1)}¢
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
