"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Dot } from "lucide-react";

import type { Locale, T } from "@/lib/i18n/translations";
import { sideLabel } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/badge";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { resolveMarketTitle } from "@/lib/short-duration-predictions";
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
  const { price, prevPrice } = useBinancePrice(binanceSymbol);

  useEffect(() => {
    if (price == null || prevPrice == null || price === prevPrice) return;
    setDirection(price > prevPrice ? "up" : "down");
    const timeoutId = setTimeout(() => setDirection(null), 800);
    return () => clearTimeout(timeoutId);
  }, [price, prevPrice]);

  const priceStyle = useMemo(() => {
    if (direction === "up") return { color: "var(--teal)", transition: "color 600ms ease" };
    if (direction === "down") return { color: "var(--rose)", transition: "color 600ms ease" };
    return { color: "var(--text-primary)", transition: "color 600ms ease" };
  }, [direction]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="tag-gold">{tc.short_duration_badge}</span>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: "10px", fontFamily: "var(--font-mono)",
              color: "var(--teal)", fontWeight: 600, letterSpacing: "0.08em",
            }}
          >
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              backgroundColor: "var(--teal)",
              animation: "pulseDot 1.5s ease-in-out infinite",
            }} />
            {tc.quick_trade}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.12em", color: "var(--text-dim)", textTransform: "uppercase" }}>
            {market.assetSymbol}
          </p>
          <p style={{
            marginTop: 4,
            fontFamily: "var(--font-mono)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: countdown.urgent ? "var(--rose)" : "var(--text-secondary)",
            animation: countdown.urgent ? "pulseDot 1s ease-in-out infinite" : "none",
          }}>
            {countdown.text}
          </p>
        </div>
      </div>

      {/* Title */}
      <div>
        <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.5 }}>
          {resolveMarketTitle(locale, market.title, market.titleZh, market.durationMinutes, market.assetSymbol)}
        </p>
        <p style={{ marginTop: 4, fontSize: "11px", color: "var(--text-secondary)" }}>
          {tc.target_price_label}{" "}
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {market.targetDirection === "below" ? tc.target_below : tc.target_above}
          </span>{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--gold)" }}>
            {market.spotPriceAtOpen != null
              ? `$${priceFormatter.format(Number(market.spotPriceAtOpen))}`
              : "—"}
          </span>
        </p>
      </div>

      {/* Live price panel */}
      <div style={{
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-elevated)",
        padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-dim)" }}>
            {tc.live_price}
          </p>
          <p style={{ ...priceStyle, marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
            {price != null ? `$${priceFormatter.format(price)}` : "—"}
          </p>
        </div>
        <div style={{
          textAlign: "right",
          borderRadius: 8,
          backgroundColor: "var(--bg-overlay)",
          border: "1px solid var(--border-subtle)",
          padding: "8px 12px",
        }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)" }}>
            {sideLabel("yes", locale)}
          </p>
          <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 700, color: "var(--teal)" }}>
            {formatPct(market.yesPrice)}
          </p>
        </div>
      </div>

      {/* Trade buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Link
          href={tradeHref}
          style={{
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, rgba(16,207,160,0.2) 0%, rgba(16,207,160,0.08) 100%)",
            border: "1px solid rgba(16,207,160,0.3)",
            padding: "9px 12px",
            textAlign: "left",
            textDecoration: "none",
            transition: "all 200ms ease",
          }}
          className="hover:border-[rgba(16,207,160,0.6)] hover:bg-[rgba(16,207,160,0.15)]"
        >
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(16,207,160,0.6)" }}>
            {tc.up_label}
          </p>
          <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700, color: "var(--teal)" }}>
            {formatPrice(market.yesPrice)}
          </p>
          <p style={{ marginTop: 2, fontSize: "11px", fontWeight: 500, color: "rgba(16,207,160,0.8)" }}>
            {sideLabel("yes", locale)} ↑
          </p>
        </Link>
        <Link
          href={tradeHref}
          style={{
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, rgba(242,56,96,0.2) 0%, rgba(242,56,96,0.08) 100%)",
            border: "1px solid rgba(242,56,96,0.3)",
            padding: "9px 12px",
            textAlign: "left",
            textDecoration: "none",
            transition: "all 200ms ease",
          }}
          className="hover:border-[rgba(242,56,96,0.6)]"
        >
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(242,56,96,0.6)" }}>
            {tc.down_label}
          </p>
          <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700, color: "var(--rose)" }}>
            {formatPrice(market.noPrice)}
          </p>
          <p style={{ marginTop: 2, fontSize: "11px", fontWeight: 500, color: "rgba(242,56,96,0.8)" }}>
            {sideLabel("no", locale)} ↓
          </p>
        </Link>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-dim)", letterSpacing: "0.06em" }}>
          {tc.closes}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-secondary)", letterSpacing: "0.04em" }}>
          {formatCloseDate(market.closeAt, locale)}
        </span>
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
    <div style={{ opacity: animating ? 0 : 1, transition: "opacity 200ms ease", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--gold)",
          backgroundColor: "var(--gold-dim)",
          border: "1px solid var(--border-gold)",
          borderRadius: 6, padding: "3px 8px",
        }}>
          {market.assetSymbol}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-dim)", fontSize: "11px" }}>
          <Clock style={{ width: 11, height: 11 }} />
          <span style={{ fontFamily: "var(--font-mono)" }}>{tc.closes} {formatCloseDate(market.closeAt, locale)}</span>
        </div>
      </div>

      <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {resolveMarketTitle(locale, market.title, market.titleZh, market.durationMinutes, market.assetSymbol)}
      </p>

      {market.yesPrice != null && (
        <div style={{ height: 3, backgroundColor: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, parseFloat(market.yesPrice) * 100)}%`,
              background: "linear-gradient(90deg, var(--teal), rgba(16,207,160,0.4))",
              borderRadius: 2,
              transition: "width 500ms ease",
            }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 24 }}>
        {[
          { label: "YES", price: market.yesPrice, color: "var(--teal)" },
          { label: "NO",  price: market.noPrice,  color: "var(--rose)" },
        ].map(({ label, price, color }) => (
          <div key={label}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)" }}>
              {label}
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 700, color, marginTop: 2 }}>
              {formatPrice(price)}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: `${sideLabel("yes", locale)} ↑`, color: "var(--teal)", bg: "rgba(16,207,160,0.12)", border: "rgba(16,207,160,0.3)" },
          { label: `${sideLabel("no", locale)} ↓`,  color: "var(--rose)", bg: "rgba(242,56,96,0.12)",  border: "rgba(242,56,96,0.3)" },
        ].map(({ label, color, bg, border }) => (
          <Link
            key={label}
            href={tradeHref}
            style={{
              borderRadius: "var(--radius-md)",
              backgroundColor: bg,
              border: `1px solid ${border}`,
              padding: "10px 14px",
              textAlign: "center",
              fontFamily: "var(--font-sans)",
              fontSize: "0.875rem",
              fontWeight: 700,
              color,
              textDecoration: "none",
              transition: "opacity 150ms ease",
            }}
            className="hover:opacity-80"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function MarketCarousel({ markets, isLoggedIn, locale, tCarousel: tc }: Props) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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

  // Swipe gesture support for touch devices
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    // Only register horizontal swipes (not vertical scroll)
    if (Math.abs(dx) > 40 && dy < 60) {
      if (dx > 0) next(); else prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [next, prev]);

  useEffect(() => {
    if (markets.length <= 1) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [markets.length, next]);

  if (markets.length === 0) {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
          {tc.markets_label}
        </p>
        <p style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--text-secondary)" }}>{tc.no_markets}</p>
        <p style={{ fontSize: "12px", color: "var(--text-dim)" }}>{tc.check_back}</p>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {["YES", "NO"].map((l) => (
            <div key={l} style={{
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              padding: "10px 14px",
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-dim)",
            }}>{l}</div>
          ))}
        </div>
      </div>
    );
  }

  const market = markets[current];
  const tradeHref = isLoggedIn ? `/markets/${market.slug}` : `/signup`;
  const isShortDuration = market.durationMinutes != null;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "pan-y" }}
    >
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

      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
        {/* YES prob */}
        <div style={{
          flex: 1,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-elevated)",
          padding: "8px 10px",
        }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)" }}>
            {tc.yes_prob}
          </p>
          <p style={{ marginTop: 3, fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "var(--teal)" }}>
            {formatPct(market.yesPrice)}
          </p>
        </div>

        {/* Nav controls */}
        {markets.length > 1 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { fn: prev, label: "Previous market", icon: ChevronLeft },
                { fn: next, label: "Next market",     icon: ChevronRight },
              ].map(({ fn, label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={fn}
                  aria-label={label}
                  style={{
                    width: 28, height: 28,
                    borderRadius: "50%",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 150ms ease",
                  }}
                  className="hover:!border-[--border-gold] hover:!text-[--gold]"
                >
                  <Icon style={{ width: 13, height: 13 }} />
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {markets.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Market ${i + 1}`}
                  style={{
                    height: 4,
                    width: i === current ? 20 : 4,
                    borderRadius: 2,
                    backgroundColor: i === current ? "var(--gold)" : "var(--border-strong)",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 300ms ease",
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* NO prob */}
        <div style={{
          flex: 1,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-elevated)",
          padding: "8px 10px",
        }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)" }}>
            {tc.no_prob}
          </p>
          <p style={{ marginTop: 3, fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "var(--rose)" }}>
            {formatPct(market.noPrice)}
          </p>
        </div>
      </div>
    </div>
  );
}
