"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Clock, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { useBinanceKlineStream } from "@/lib/hooks/use-binance-kline-stream";
import { computeBinaryYesPrice, getShortDurationCutoffAt } from "@/lib/short-duration-predictions";
import { OVERROUND } from "@/lib/config/trading-constants";
import { cryptoIconUrl, hasCryptoIcon } from "@/lib/helpers/crypto-icon";
import type { DashboardLiveRound } from "@/lib/services/dashboard-data";
import type { Locale } from "@/lib/i18n/translations";

function applyOverround(p: number): number {
  return Math.max(0.01, Math.min(0.99, p * (1 + OVERROUND)));
}

function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function LiveRoundCard({
  market,
  onClosed,
}: {
  market: DashboardLiveRound;
  onClosed: (id: string) => void;
}) {
  // Start null to avoid SSR/client mismatch — populated in useEffect
  const [now, setNow] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const binanceSymbol = ASSET_TO_BINANCE[market.assetSymbol] ?? null;
  const { currentPrice: liveSpot, candles } = useBinanceKlineStream(binanceSymbol);

  const nowMs = now ?? new Date(market.closeAt).getTime(); // safe fallback; updated immediately after mount
  const secondsRemaining = Math.max(
    0,
    Math.floor((new Date(market.closeAt).getTime() - nowMs) / 1_000),
  );
  const cutoffAt = market.cutoffAt ?? getShortDurationCutoffAt(market.closeAt).toISOString();
  const isClosed = now != null && Math.floor((new Date(cutoffAt).getTime() - nowMs) / 1_000) <= 0;

  useEffect(() => {
    if (isClosed && !firedRef.current) {
      firedRef.current = true;
      onClosed(market.id);
    }
  }, [isClosed, market.id, onClosed]);

  const fairYes = useMemo(() => {
    if (liveSpot == null || market.spotPriceAtOpen == null) return 0.5;
    return computeBinaryYesPrice({
      currentSpotPrice: liveSpot,
      openingSpotPrice: Number(market.spotPriceAtOpen),
      secondsRemaining,
      recentCandles: candles,
    });
  }, [liveSpot, market.spotPriceAtOpen, secondsRemaining, candles]);

  const yesPrice = applyOverround(fairYes);
  const noPrice  = applyOverround(1 - fairYes);

  const openingSpot = market.spotPriceAtOpen ? Number(market.spotPriceAtOpen) : null;
  const pctDiff =
    liveSpot != null && openingSpot != null
      ? ((liveSpot - openingSpot) / openingSpot) * 100
      : null;
  const isUp = pctDiff != null ? pctDiff >= 0 : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${isClosed ? "var(--border-dim)" : "var(--border-gold)"}`,
        backgroundColor: "var(--bg-surface)",
        padding: "1rem",
        transition: "all 200ms ease",
        opacity: isClosed ? 0.55 : 1,
        boxShadow: isClosed ? "none" : "0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(232,160,32,0.06)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {hasCryptoIcon(market.assetSymbol) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cryptoIconUrl(market.assetSymbol)}
              alt={market.assetSymbol}
              width={36}
              height={36}
              style={{ borderRadius: "50%", boxShadow: "0 0 0 2px var(--border-gold)" }}
            />
          ) : (
            <span
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: "50%",
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-strong)",
                fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {market.assetSymbol.slice(0, 2)}
            </span>
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {market.assetSymbol}
              </span>
              {!isClosed && (
                <span
                  style={{
                    width: 7, height: 7, borderRadius: "50%",
                    backgroundColor: "var(--teal)",
                    boxShadow: "0 0 6px var(--teal)",
                    animation: "pulseDot 1.5s ease-in-out infinite",
                    display: "inline-block",
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                fontWeight: 600, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "var(--gold)",
              }}
            >
              {market.durationMinutes} min round
            </span>
          </div>
        </div>

        {/* Countdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Clock style={{ width: 12, height: 12, color: "var(--text-dim)" }} />
          <span
            style={{
              fontFamily: "var(--font-mono)", fontSize: "0.9375rem", fontWeight: 700,
              color: isClosed ? "var(--text-dim)" : secondsRemaining <= 60 ? "var(--rose)" : "var(--text-secondary)",
              letterSpacing: "0.04em",
            }}
          >
            {isClosed ? "Closed" : formatCountdown(secondsRemaining)}
          </span>
        </div>
      </div>

      {/* Live price */}
      <div style={{ marginBottom: "0.75rem" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)", fontSize: "1.375rem", fontWeight: 700,
            letterSpacing: "-0.02em", color: "var(--text-primary)",
          }}
        >
          {liveSpot != null
            ? `$${liveSpot.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : <span style={{ color: "var(--text-dim)", fontSize: "1rem" }}>—</span>
          }
        </span>
        {pctDiff != null && (
          <span
            style={{
              marginLeft: 8,
              fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 600,
              color: isUp ? "var(--teal)" : "var(--rose)",
              display: "inline-flex", alignItems: "center", gap: 2,
            }}
          >
            {isUp
              ? <ArrowUp style={{ width: 10, height: 10 }} />
              : <ArrowDown style={{ width: 10, height: 10 }} />
            }
            {Math.abs(pctDiff).toFixed(3)}%
          </span>
        )}
      </div>

      {/* UP / DOWN tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: "0.75rem" }}>
        {[
          { label: "UP",   price: yesPrice, isUp: true  },
          { label: "DOWN", price: noPrice,  isUp: false },
        ].map(({ label, price, isUp: tileUp }) => (
          <div
            key={label}
            style={{
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${tileUp ? "rgba(13,184,145,0.2)" : "rgba(232,68,90,0.2)"}`,
              backgroundColor: tileUp ? "var(--teal-dim)" : "var(--rose-dim)",
              padding: "8px 10px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                color: tileUp ? "var(--teal)" : "var(--rose)",
              }}
            >
              {label}
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700,
                color: "var(--text-primary)", lineHeight: 1.1, marginTop: 2,
              }}
            >
              {(price * 100).toFixed(0)}¢
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                fontWeight: 600, color: "var(--text-dim)", marginTop: 1,
              }}
            >
              {(1 / price).toFixed(2)}× payout
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link
        href={`/markets/${market.slug}`}
        style={{
          marginTop: "auto",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px 0",
          borderRadius: "var(--radius-sm)",
          background: isClosed
            ? "var(--bg-elevated)"
            : "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
          border: isClosed ? "1px solid var(--border-subtle)" : "none",
          fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 700,
          color: isClosed ? "var(--text-secondary)" : "#070809",
          textDecoration: "none",
          transition: "opacity 150ms ease",
          boxShadow: isClosed ? "none" : "0 0 12px rgba(232,160,32,0.15)",
        }}
        className={isClosed ? "" : "hover:opacity-90"}
      >
        {isClosed ? "View Round" : "Trade Now"}
        <ArrowRight style={{ width: 13, height: 13 }} />
      </Link>
    </div>
  );
}

function useVisibleCount() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w >= 1024) setCount(3);
      else if (w >= 640) setCount(2);
      else setCount(1);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return count;
}

export function LiveRoundsWidget({
  markets,
}: {
  markets: DashboardLiveRound[];
  locale: Locale;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const visibleCount = useVisibleCount();
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closedIdsRef = useRef<Set<string>>(new Set());

  const handleCardClosed = useCallback(
    (id: string) => {
      closedIdsRef.current.add(id);
      if (closedIdsRef.current.size >= markets.length) {
        setTimeout(() => router.refresh(), 15_000);
      }
    },
    [markets.length, router],
  );

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  const total = markets.length;
  const maxIndex = Math.max(0, total - visibleCount);

  const prev = useCallback(() => {
    setIndex((i) => (i === 0 ? maxIndex : i - 1));
  }, [maxIndex]);

  const next = useCallback(() => {
    setIndex((i) => (i >= maxIndex ? 0 : i + 1));
  }, [maxIndex]);

  useEffect(() => {
    if (paused || total <= visibleCount) return;
    autoRef.current = setInterval(next, 5_000);
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [paused, next, total, visibleCount]);

  useEffect(() => {
    setIndex((i) => Math.min(i, maxIndex));
  }, [maxIndex]);

  if (total === 0) return null;

  const showArrows = total > visibleCount;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 7, height: 7, borderRadius: "50%",
              backgroundColor: "var(--rose)",
              animation: "pulseDot 1.5s ease-in-out infinite",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)", fontSize: "0.625rem",
              fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--text-secondary)",
            }}
          >
            Live Rounds
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
              fontWeight: 600, padding: "1px 7px",
              borderRadius: 100,
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-dim)",
            }}
          >
            {total}
          </span>
        </div>
        <Link
          href="/markets"
          style={{
            fontFamily: "var(--font-sans)", fontSize: "0.75rem",
            fontWeight: 600, color: "var(--gold)",
            textDecoration: "none",
          }}
          className="hover:opacity-80"
        >
          All markets →
        </Link>
      </div>

      {/* Carousel */}
      <div
        style={{ position: "relative" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {showArrows && (
          <button
            onClick={prev}
            style={{
              position: "absolute", left: -12, top: "50%", zIndex: 10,
              transform: "translateY(-50%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: "50%",
              border: "1px solid var(--border-strong)",
              backgroundColor: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              cursor: "pointer", transition: "all 150ms ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
            className="hover:border-[var(--border-gold)] hover:text-[var(--gold)]"
            aria-label="Previous"
          >
            <ChevronLeft style={{ width: 14, height: 14 }} />
          </button>
        )}

        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "flex", gap: 12,
              transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
              transform: `translateX(calc(-${index} * (100% / ${visibleCount}) - ${index} * (12px / ${visibleCount})))`,
            }}
          >
            {markets.map((m) => (
              <div
                key={m.id}
                style={{
                  minWidth: 0, flexShrink: 0,
                  width: `calc(${100 / visibleCount}% - ${(12 * (visibleCount - 1)) / visibleCount}px)`,
                }}
              >
                <LiveRoundCard market={m} onClosed={handleCardClosed} />
              </div>
            ))}
          </div>
        </div>

        {showArrows && (
          <button
            onClick={next}
            style={{
              position: "absolute", right: -12, top: "50%", zIndex: 10,
              transform: "translateY(-50%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: "50%",
              border: "1px solid var(--border-strong)",
              backgroundColor: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              cursor: "pointer", transition: "all 150ms ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
            className="hover:border-[var(--border-gold)] hover:text-[var(--gold)]"
            aria-label="Next"
          >
            <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {/* Dots */}
      {showArrows && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: "0.75rem" }}>
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                borderRadius: 100, border: "none", cursor: "pointer",
                transition: "all 300ms ease",
                height: 6,
                width: i === index ? 20 : 6,
                backgroundColor: i === index ? "var(--gold)" : "var(--border-strong)",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
