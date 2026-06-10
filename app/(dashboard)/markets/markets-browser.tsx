"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TrendingUp, Clock, ChevronRight, Search, X, ArrowRight, Trophy } from "lucide-react";

import { formatDecimal } from "@/lib/helpers/format-decimal";
import { sideLabel, statusLabel } from "@/lib/i18n/labels";
import { resolveMarketTitle } from "@/lib/short-duration-predictions";
import { cryptoIconUrl, hasCryptoIcon } from "@/lib/helpers/crypto-icon";
import { useBinancePrice } from "@/lib/hooks/use-binance-price";
import type { MarketListItem } from "@/lib/services/market-data";
import type { Locale } from "@/lib/i18n/translations";
import { getT } from "@/lib/i18n/translations";

type Tab = "all" | "3" | "5" | "10" | "15" | "30" | "standard";

function useCountdown(closeAt: string, onExpired?: () => void) {
  const getSecsLeft = useCallback(
    () => Math.max(0, Math.floor((new Date(closeAt).getTime() - Date.now()) / 1000)),
    [closeAt],
  );
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const initial = getSecsLeft();
    setSecsLeft(initial);
    // Fire immediately if already expired on mount
    if (initial === 0) {
      firedRef.current = true;
      onExpired?.();
    }
    const id = setInterval(() => {
      const s = getSecsLeft();
      setSecsLeft(s);
      if (s === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [getSecsLeft, onExpired]);

  if (secsLeft == null) return "--:--";
  const mm = String(Math.floor(secsLeft / 60)).padStart(2, "0");
  const ss = String(secsLeft % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function ShortDurationCard({
  market,
  locale,
  t,
}: {
  market: MarketListItem;
  locale: Locale;
  t: { short_duration_badge: string; live_contract: string; trade_now: string };
}) {
  const router = useRouter();
  const [settling, setSettling] = useState(false);
  const binanceSymbol = `${market.assetSymbol}USDT`;
  const { price: livePrice } = useBinancePrice(binanceSymbol);
  const onExpired = useCallback(() => {
    setSettling(true);
    const settle = async () => {
      try {
        await fetch(
          `/api/markets/active?asset=${market.assetSymbol}&duration=${market.durationMinutes}`,
        );
      } catch {
        // non-critical
      }
      router.refresh();
    };
    settle();
    setTimeout(settle, 5000);
    setTimeout(settle, 10000);
    setTimeout(settle, 20000);
  }, [router, market.assetSymbol, market.durationMinutes]);
  const countdown = useCountdown(market.closeAt, onExpired);

  const openPrice = market.spotPriceAtOpen ? parseFloat(market.spotPriceAtOpen) : null;
  const pctChange =
    livePrice != null && openPrice != null && openPrice > 0
      ? ((livePrice - openPrice) / openPrice) * 100
      : null;
  const pctUp = pctChange != null && pctChange >= 0;

  const yesP = market.yesPrice != null ? parseFloat(market.yesPrice) : null;
  const noP = market.noPrice != null ? parseFloat(market.noPrice) : null;
  const yesCents = yesP != null ? Math.round(yesP * 100) : null;
  const noCents = noP != null ? Math.round(noP * 100) : null;
  const yesMult = yesP != null && yesP > 0 ? (1 / yesP).toFixed(2) : null;
  const noMult = noP != null && noP > 0 ? (1 / noP).toFixed(2) : null;

  const durationLabel =
    market.durationMinutes != null
      ? locale === "zh"
        ? `${market.durationMinutes} 分钟轮次`
        : `${market.durationMinutes} MIN ROUND`
      : t.short_duration_badge;

  const upLabel = locale === "zh" ? "涨" : "UP";
  const downLabel = locale === "zh" ? "跌" : "DOWN";
  const tradeNow = locale === "zh" ? "立即交易" : "Trade Now";

  return (
    <Link href={`/markets/${market.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          position: "relative",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-gold)",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem",
          overflow: "hidden",
          transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(232,160,32,0.08)",
          cursor: "pointer",
        }}
        className="group hover:border-[var(--gold)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(232,160,32,0.12)]"
      >
        {/* Subtle gold ambient */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-20%",
            right: "-10%",
            width: "50%",
            height: "60%",
            background: "radial-gradient(ellipse, rgba(232,160,32,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Row 1: Logo + name + live dot  |  Round label + countdown */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {/* Left: logo + name + live dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {hasCryptoIcon(market.assetSymbol) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cryptoIconUrl(market.assetSymbol)}
                alt={market.assetSymbol}
                width={36}
                height={36}
                style={{ borderRadius: "50%", flexShrink: 0, boxShadow: "0 0 0 2px var(--border-gold)" }}
              />
            ) : (
              <span
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: "50%",
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border-strong)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem", fontWeight: 700,
                  color: "var(--text-primary)",
                  flexShrink: 0,
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
                {/* Live dot */}
                <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 8, height: 8 }}>
                  <span
                    style={{
                      position: "absolute", width: 16, height: 16,
                      borderRadius: "50%",
                      backgroundColor: "rgba(16,207,160,0.25)",
                      animation: "pulseDot 1.5s ease-in-out infinite",
                    }}
                  />
                  <span style={{ position: "relative", width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--teal)", boxShadow: "0 0 8px var(--teal)" }} />
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                }}
              >
                {durationLabel}
              </span>
            </div>
          </div>

          {/* Right: Countdown */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <Clock style={{ width: 13, height: 13, color: "var(--text-dim)" }} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: settling ? "0.6875rem" : "0.9375rem",
                fontWeight: 700,
                color: settling ? "var(--gold)" : "var(--text-secondary)",
                letterSpacing: "0.04em",
              }}
            >
              {settling ? "Settling…" : countdown}
            </span>
          </div>
        </div>

        {/* Row 2: Live price + pct change */}
        <div style={{ marginTop: "1rem" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "1.625rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              lineHeight: 1,
            }}
          >
            {livePrice != null
              ? `$${livePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : <span style={{ color: "var(--text-dim)", fontSize: "1rem" }}>—</span>
            }
          </div>
          {pctChange != null && (
            <div
              style={{
                marginTop: 4,
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                fontWeight: 500,
                color: pctUp ? "var(--teal)" : "var(--rose)",
              }}
            >
              {pctUp ? "↑" : "↓"} {Math.abs(pctChange).toFixed(3)}%{" "}
              <span style={{ color: "var(--text-dim)" }}>
                {locale === "zh" ? "较开盘" : "from open"}
              </span>
            </div>
          )}
        </div>

        {/* Row 3: UP / DOWN boxes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: "0.875rem" }}>
          {/* UP box */}
          <div
            style={{
              backgroundColor: "var(--teal-dim)",
              border: "1px solid rgba(16,207,160,0.25)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--teal)" }}>
              {upLabel}
            </div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
              {yesCents != null ? `${yesCents}¢` : "—"}
            </div>
            {yesMult && (
              <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--teal)", fontWeight: 600 }}>
                {yesMult}×
              </div>
            )}
          </div>

          {/* DOWN box */}
          <div
            style={{
              backgroundColor: "var(--rose-dim)",
              border: "1px solid rgba(242,56,96,0.25)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--rose)" }}>
              {downLabel}
            </div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
              {noCents != null ? `${noCents}¢` : "—"}
            </div>
            {noMult && (
              <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--rose)", fontWeight: 600 }}>
                {noMult}×
              </div>
            )}
          </div>
        </div>

        {/* Row 4: Trade Now button */}
        <div
          style={{
            marginTop: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "9px 0",
            borderRadius: "var(--radius-sm)",
            background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "#070809",
            boxShadow: "0 0 16px rgba(232,160,32,0.25)",
            transition: "opacity 150ms ease",
          }}
          className="group-hover:opacity-90"
        >
          {tradeNow}
          <ArrowRight style={{ width: 14, height: 14 }} />
        </div>
      </div>
    </Link>
  );
}

function StandardCard({
  market,
  locale,
  t,
  dateLocale,
}: {
  market: MarketListItem;
  locale: Locale;
  t: { trade_now: string; closes: string };
  dateLocale: string;
}) {
  const positiveLabel = sideLabel("yes", locale);
  const negativeLabel = sideLabel("no", locale);
  const yes = market.yesPrice != null ? Math.min(100, Math.max(0, parseFloat(market.yesPrice) * 100)) : 50;
  const no = 100 - yes;

  return (
    <Link href={`/markets/${market.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem",
          transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        className="group hover:border-[var(--border-strong)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {hasCryptoIcon(market.assetSymbol) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cryptoIconUrl(market.assetSymbol)}
                alt={market.assetSymbol}
                width={32}
                height={32}
                style={{ borderRadius: "50%", flexShrink: 0 }}
              />
            ) : (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-strong)", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>
                {market.assetSymbol.slice(0, 2)}
              </span>
            )}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {market.assetSymbol}
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.625rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 100,
              backgroundColor: market.status === "active" ? "var(--teal-dim)" : "var(--bg-elevated)",
              border: `1px solid ${market.status === "active" ? "rgba(16,207,160,0.3)" : "var(--border-subtle)"}`,
              color: market.status === "active" ? "var(--teal)" : "var(--text-dim)",
            }}
          >
            {statusLabel(market.status, locale)}
          </span>
        </div>

        <h3
          style={{
            marginTop: "0.75rem",
            fontFamily: "var(--font-sans)",
            fontSize: "0.875rem",
            fontWeight: 500,
            lineHeight: 1.45,
            color: "var(--text-primary)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flex: 1,
          }}
        >
          {resolveMarketTitle(locale, market.title, market.titleZh, market.durationMinutes, market.assetSymbol)}
        </h3>

        <div style={{ display: "flex", gap: 20, marginTop: "1rem" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>{sideLabel("yes", locale)}</p>
            <p style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "var(--teal)" }}>
              {market.yesPrice != null ? `$${formatDecimal(market.yesPrice, 2)}` : "—"}
            </p>
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>{sideLabel("no", locale)}</p>
            <p style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "var(--rose)" }}>
              {market.noPrice != null ? `$${formatDecimal(market.noPrice, 2)}` : "—"}
            </p>
          </div>
        </div>

        {/* Probability bar */}
        <div style={{ marginTop: "0.75rem" }}>
          <div style={{ height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "var(--bg-elevated)", display: "flex" }}>
            <div style={{ width: `${yes}%`, backgroundColor: "var(--teal)", transition: "width 300ms ease" }} />
            <div style={{ width: `${no}%`, backgroundColor: "var(--rose)", transition: "width 300ms ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "var(--teal)" }}>{yes.toFixed(0)}% {positiveLabel}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "var(--rose)" }}>{no.toFixed(0)}% {negativeLabel}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: "0.75rem" }}>
          <Clock style={{ width: 11, height: 11, color: "var(--text-dim)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "var(--text-dim)" }}>
            {t.closes}{" "}
            {new Date(market.closeAt).toLocaleDateString(dateLocale, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        <div
          style={{
            marginTop: "0.75rem",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "var(--font-sans)",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--gold)",
            opacity: 0,
            transition: "opacity 150ms ease",
          }}
          className="group-hover:!opacity-100"
        >
          {t.trade_now} <ChevronRight style={{ width: 13, height: 13 }} />
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// World Cup themed card
// ---------------------------------------------------------------------------

function WorldCupCard({
  market,
  locale,
  dateLocale,
  closes,
}: {
  market: MarketListItem;
  locale: Locale;
  dateLocale: string;
  closes: string;
}) {
  const yes = market.yesPrice != null ? Math.min(100, Math.max(0, parseFloat(market.yesPrice) * 100)) : 50;
  const no = 100 - yes;

  return (
    <Link href={`/markets/${market.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#0a1f0d",
          border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: "var(--radius-lg)",
          padding: "1.125rem",
          transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(34,197,94,0.06)",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        className="group hover:border-[rgba(34,197,94,0.4)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.5),0_0_16px_rgba(34,197,94,0.1)]"
      >
        {/* Grass stripe ambient */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,255,255,0.018) 18px, rgba(255,255,255,0.018) 20px)",
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.08) 100%)",
                border: "1px solid rgba(34,197,94,0.3)",
                fontSize: "0.875rem",
                flexShrink: 0,
              }}
            >
              ⚽
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: "#4ade80",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              FIFA
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.5625rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 100,
              backgroundColor: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.2)",
              color: "#4ade80",
            }}
          >
            {statusLabel(market.status, locale)}
          </span>
        </div>

        <h3
          style={{
            marginTop: "0.625rem",
            fontFamily: "var(--font-sans)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.9)",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flex: 1,
            position: "relative",
          }}
        >
          {locale === "zh" && market.titleZh ? market.titleZh : market.title}
        </h3>

        <div style={{ display: "flex", gap: 16, marginTop: "0.875rem", position: "relative" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>{sideLabel("yes", locale)}</p>
            <p style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "#4ade80" }}>
              {market.yesPrice != null ? `$${formatDecimal(market.yesPrice, 2)}` : "—"}
            </p>
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>{sideLabel("no", locale)}</p>
            <p style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "var(--rose)" }}>
              {market.noPrice != null ? `$${formatDecimal(market.noPrice, 2)}` : "—"}
            </p>
          </div>
        </div>

        {/* Probability bar — green themed */}
        <div style={{ marginTop: "0.625rem", position: "relative" }}>
          <div style={{ height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)", display: "flex" }}>
            <div style={{ width: `${yes}%`, backgroundColor: "#4ade80", transition: "width 300ms ease" }} />
            <div style={{ width: `${no}%`, backgroundColor: "var(--rose)", transition: "width 300ms ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "#4ade80" }}>{yes.toFixed(0)}% {sideLabel("yes", locale)}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "var(--rose)" }}>{no.toFixed(0)}% {sideLabel("no", locale)}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: "0.625rem", position: "relative" }}>
          <Clock style={{ width: 10, height: 10, color: "rgba(255,255,255,0.3)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.625rem", color: "rgba(255,255,255,0.3)" }}>
            {closes}{" "}
            {new Date(market.closeAt).toLocaleDateString(dateLocale, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        <div
          style={{
            marginTop: "0.625rem",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "var(--font-sans)",
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "#4ade80",
            opacity: 0,
            transition: "opacity 150ms ease",
            position: "relative",
          }}
          className="group-hover:!opacity-100"
        >
          {locale === "zh" ? "立即交易" : "Trade Now"} <ChevronRight style={{ width: 12, height: 12 }} />
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// World Cup section — filter + expand/collapse
// ---------------------------------------------------------------------------

type WCFilter = "all" | "winner" | "round1" | "round2" | "round3";

function getWCCategory(title: string): WCFilter {
  const t = title.toLowerCase();
  if (t.includes("win the 2026 fifa world cup") || t.includes("world cup winner") || t.includes("win the fifa world cup")) return "winner";
  if (t.includes("round 1")) return "round1";
  if (t.includes("round 2")) return "round2";
  if (t.includes("round 3")) return "round3";
  return "all";
}

function getWCFilterLabels(locale: Locale): Record<WCFilter, string> {
  const t = getT(locale).world_cup;
  return { all: t.filter_all, winner: t.filter_winner, round1: t.filter_round1, round2: t.filter_round2, round3: t.filter_round3 };
}

const PREVIEW_COUNT = 6;

function WorldCupSection({
  markets,
  locale,
  dateLocale,
}: {
  markets: MarketListItem[];
  locale: Locale;
  dateLocale: string;
}) {
  const [filter, setFilter] = useState<WCFilter>("all");
  const [expanded, setExpanded] = useState(false);

  if (markets.length === 0) return null;

  const twc = getT(locale).world_cup;
  const filterLabels = getWCFilterLabels(locale);

  // Which filter tabs actually have markets?
  const availableFilters: WCFilter[] = ["all"];
  const filterCounts: Partial<Record<WCFilter, number>> = { all: markets.length };
  for (const f of ["winner", "round1", "round2", "round3"] as WCFilter[]) {
    const count = markets.filter((m) => getWCCategory(m.title) === f).length;
    if (count > 0) { availableFilters.push(f); filterCounts[f] = count; }
  }

  const filtered = filter === "all" ? markets : markets.filter((m) => getWCCategory(m.title) === filter);
  const visible  = expanded ? filtered : filtered.slice(0, PREVIEW_COUNT);
  const hasMore  = filtered.length > PREVIEW_COUNT;

  // Reset expand when filter changes
  const handleFilter = (f: WCFilter) => { setFilter(f); setExpanded(false); };

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius-lg)",
        border: "1px solid rgba(34,197,94,0.2)",
        background: "linear-gradient(180deg, rgba(10,31,13,0.9) 0%, rgba(7,20,8,0.95) 100%)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Grass stripe pattern */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 32px, rgba(255,255,255,0.015) 32px, rgba(255,255,255,0.015) 34px)",
          pointerEvents: "none",
        }}
      />
      {/* Ambient glow */}
      <div aria-hidden style={{ position: "absolute", top: "-20%", right: "10%", width: "30%", height: "60%", background: "radial-gradient(ellipse, rgba(34,197,94,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      {/* Top accent line */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.6) 30%, rgba(34,197,94,0.95) 50%, rgba(34,197,94,0.6) 70%, transparent)", pointerEvents: "none" }} />

      {/* ── Header ── */}
      <div style={{ position: "relative", padding: "1.25rem 1.5rem 0" }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>⚽</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "1.125rem", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
                  {twc.title}
                </span>
                <span style={{ fontSize: "0.875rem", lineHeight: 1 }}>🇺🇸🇨🇦🇲🇽</span>
              </div>
              <p style={{ marginTop: 2, fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "rgba(255,255,255,0.4)" }}>
                {twc.nations_sub}
              </p>
            </div>
          </div>

          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase", color: "#4ade80",
              backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 100, padding: "3px 10px",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
            {twc.featured_badge}
          </span>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: "flex", gap: 4, overflowX: "auto",
            borderBottom: "1px solid rgba(34,197,94,0.1)",
            paddingBottom: "0",
            marginLeft: "-0.25rem",
          }}
        >
          {availableFilters.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => handleFilter(f)}
                style={{
                  flexShrink: 0,
                  padding: "7px 14px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  border: "none",
                  borderBottom: active ? "2px solid #4ade80" : "2px solid transparent",
                  borderRadius: 0,
                  background: "transparent",
                  color: active ? "#4ade80" : "rgba(255,255,255,0.35)",
                  transition: "color 150ms ease, border-color 150ms ease",
                  whiteSpace: "nowrap",
                  marginBottom: "-1px",
                }}
              >
                {filterLabels[f]}
                {filterCounts[f] !== undefined && (
                  <span style={{ marginLeft: 5, opacity: 0.6, fontWeight: 500 }}>
                    {filterCounts[f]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Markets grid ── */}
      <div style={{ padding: "1.25rem", position: "relative" }}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((market) => (
            <WorldCupCard
              key={market.id}
              market={market}
              locale={locale}
              dateLocale={dateLocale}
              closes={getT(locale).markets.closes}
            />
          ))}
        </div>

        {/* ── Expand / collapse ── */}
        {hasMore && (
          <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => setExpanded((e) => !e)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 20px",
                fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 600,
                color: "#4ade80",
                backgroundColor: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                transition: "background-color 150ms ease, border-color 150ms ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(34,197,94,0.13)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(34,197,94,0.08)"; }}
            >
              {expanded
                ? <>{twc.show_less} <span style={{ fontSize: "0.75rem" }}>↑</span></>
                : <>{twc.show_all.replace("{n}", String(filtered.length))} <span style={{ fontSize: "0.75rem" }}>↓</span></>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Derive available duration tabs from the market list
function getDurationTabs(markets: MarketListItem[]): Tab[] {
  const durations = new Set(
    markets
      .filter((m) => m.durationMinutes != null)
      .map((m) => String(m.durationMinutes) as Tab),
  );
  const hasStandard = markets.some((m) => m.durationMinutes == null);
  const order: Tab[] = ["3", "5", "10", "15", "30"];
  const tabs: Tab[] = ["all", ...order.filter((d) => durations.has(d))];
  if (hasStandard) tabs.push("standard");
  return tabs;
}

export function MarketsBrowser({
  markets,
  locale,
  t,
}: {
  markets: MarketListItem[];
  locale: Locale;
  t: {
    no_markets: string;
    no_markets_sub: string;
    short_duration_badge: string;
    live_contract: string;
    trade_now: string;
    closes: string;
  };
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";

  // Split World Cup markets from regular markets
  const worldCupMarkets = useMemo(
    () => markets.filter((m) => m.assetSymbol === "FIFA"),
    [markets],
  );
  const regularMarkets = useMemo(
    () => markets.filter((m) => m.assetSymbol !== "FIFA"),
    [markets],
  );

  const tabs = useMemo(() => getDurationTabs(regularMarkets), [regularMarkets]);

  const tabLabel = (t: Tab) => {
    if (t === "all") return locale === "zh" ? "全部" : "All";
    if (t === "standard") return locale === "zh" ? "标准" : "Standard";
    return `${t} min`;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return regularMarkets.filter((m) => {
      const matchesTab =
        tab === "all" ||
        (tab === "standard" && m.durationMinutes == null) ||
        String(m.durationMinutes) === tab;
      const matchesSearch =
        !q ||
        m.assetSymbol.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.titleZh ?? "").toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [regularMarkets, tab, query]);

  if (markets.length === 0) {
    return (
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "5rem 1rem", textAlign: "center",
          backgroundColor: "var(--bg-surface)", border: "1px dashed var(--border-subtle)", borderRadius: "var(--radius-lg)",
        }}
      >
        <TrendingUp style={{ width: 40, height: 40, color: "var(--text-dim)", marginBottom: "1rem" }} />
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)" }}>{t.no_markets}</p>
        <p style={{ marginTop: 4, fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{t.no_markets_sub}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* World Cup featured event */}
      <WorldCupSection
        markets={worldCupMarkets}
        locale={locale}
        dateLocale={dateLocale}
      />

      {/* Regular markets — only show if there are any */}
      {regularMarkets.length > 0 && (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Section label when World Cup is also shown */}
        {worldCupMarkets.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-subtle)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
              {getT(locale).world_cup.divider}
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-subtle)" }} />
          </div>
        )}
      {/* Search + tabs row */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} className="sm:flex-row sm:items-center sm:justify-between">
        {/* Duration tabs */}
        {tabs.length > 1 && (
          <div
            style={{
              display: "flex", gap: 4, overflowX: "auto",
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: 4,
            }}
          >
            {tabs.map((tabItem) => (
              <button
                key={tabItem}
                onClick={() => setTab(tabItem)}
                style={{
                  whiteSpace: "nowrap",
                  padding: "6px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  border: "none",
                  transition: "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
                  backgroundColor: tab === tabItem ? "var(--bg-surface)" : "transparent",
                  color: tab === tabItem ? "var(--gold)" : "var(--text-dim)",
                  boxShadow: tab === tabItem ? "0 1px 4px rgba(0,0,0,0.3), 0 0 0 1px var(--border-gold)" : "none",
                }}
              >
                {tabLabel(tabItem)}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ position: "relative", width: "100%" }} className="sm:w-52">
          <Search
            style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              width: 13, height: 13, color: "var(--text-dim)", pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder={locale === "zh" ? "搜索市场…" : "Search markets…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "7px 30px 7px 30px",
              fontFamily: "var(--font-sans)",
              fontSize: "0.8125rem",
              color: "var(--text-primary)",
              outline: "none",
              transition: "border-color 150ms ease",
            }}
            className="focus:border-[var(--gold)] placeholder:text-[var(--text-dim)]"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: 2,
              }}
            >
              <X style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {(query || tab !== "all") && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--text-dim)", letterSpacing: "0.04em" }}>
          {filtered.length} {locale === "zh" ? "个市场" : filtered.length === 1 ? "market" : "markets"}
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 1rem", textAlign: "center" }}>
          <Search style={{ width: 32, height: 32, color: "var(--text-dim)", marginBottom: "0.75rem" }} />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            {locale === "zh" ? "没有找到匹配的市场" : "No markets match your search"}
          </p>
          <button
            onClick={() => { setQuery(""); setTab("all"); }}
            style={{ marginTop: 8, fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 600, color: "var(--gold)", background: "none", border: "none", cursor: "pointer" }}
          >
            {locale === "zh" ? "清除筛选" : "Clear filters"}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((market) =>
            market.durationMinutes != null ? (
              <ShortDurationCard
                key={market.id}
                market={market}
                locale={locale}
                t={t}
              />
            ) : (
              <StandardCard
                key={market.id}
                market={market}
                locale={locale}
                t={t}
                dateLocale={dateLocale}
              />
            ),
          )}
        </div>
      )}
      </div>
      )}
    </div>
  );
}
