"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, ChevronDown } from "lucide-react";

import { TradeForm } from "./trade-form";
import { MarketPositionPanel } from "./market-position-panel";
import type { Locale, T } from "@/lib/i18n/translations";

type Props = {
  marketId: string;
  yesPrice: string | null;
  noPrice: string | null;
  marketStatus: string;
  isShortDuration: boolean;
  assetSymbol: string;
  closeAt: string;
  cutoffAt?: string | null;
  spotPriceAtOpen?: string | null;
  durationMinutes?: number;
  isUpcoming?: boolean;
  locale: Locale;
  t: T["trade"];
};

export function TradeArea(props: Props) {
  const { yesPrice, noPrice, marketStatus, locale, isShortDuration } = props;
  const zh = locale === "zh";

  const [tick, setTick] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [view, setView] = useState<"trade" | "position">("trade");
  const [hasPosition, setHasPosition] = useState(false);
  const [mounted, setMounted] = useState(false);

  const desktopRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // On mount (and whenever marketId changes — e.g. after navigation), check
  // whether the user already has a position so the mobile sheet shows the
  // "Position" tab and the FAB navigates there directly. Without this,
  // hasPosition stays false until a *new* trade is placed in this session,
  // making pre-existing positions (e.g. bought into a future round) invisible
  // in the mobile UI.
  useEffect(() => {
    let cancelled = false;
    const checkPosition = async () => {
      try {
        const res = await fetch(`/api/markets/${props.marketId}/my-position`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json() as { hasPosition?: boolean };
        if (json.hasPosition && !cancelled) {
          setHasPosition(true);
          setView("position");
        }
      } catch {
        // non-critical
      }
    };
    void checkPosition();
    return () => { cancelled = true; };
  }, [props.marketId]);

  const isActive = marketStatus === "active";

  const handleTradeSuccess = () => {
    setTick((n) => n + 1);
    setHasPosition(true);
    setView("position");
    // keep sheet open so user sees their position immediately
  };

  const handleBuyAgain = () => {
    setFormKey((k) => k + 1); // remount form → reset all form state
    setView("trade");
    setIsExpanded(true);
  };

  // Scroll desktop form into view on "Buy Again" from desktop position panel
  const handleDesktopBuyAgain = () => {
    desktopRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const yesP = yesPrice != null ? parseFloat(yesPrice) : null;
  const noP  = noPrice  != null ? parseFloat(noPrice)  : null;
  const upLabel   = isShortDuration ? (zh ? "看涨" : "UP")   : "YES";
  const downLabel = isShortDuration ? (zh ? "看跌" : "DOWN") : "NO";

  const sharedPositionProps = {
    marketId: props.marketId,
    isShortDuration: props.isShortDuration,
    assetSymbol: props.assetSymbol,
    closeAt: props.closeAt,
    spotPriceAtOpen: props.spotPriceAtOpen,
    locale: props.locale,
    refreshTick: tick,
  };

  return (
    <>
      {/* ── Desktop: full inline layout ──────────────────────────────────── */}
      <div className="hidden lg:block space-y-4" ref={desktopRef}>
        <TradeForm {...props} onTradeSuccess={() => setTick((n) => n + 1)} />
        <MarketPositionPanel
          {...sharedPositionProps}
          onBuyAgain={handleDesktopBuyAgain}
        />
      </div>

      {/* ── Mobile: position panel renders inline (below page content) ───── */}
      {/*   Hidden — only shown in the sheet via portal                       */}

      {/* ── Mobile portal: pill + bottom sheet ──────────────────────────── */}
      {mounted && isActive && createPortal(
        <div className="lg:hidden">
          {/* Backdrop */}
          <div
            aria-hidden
            onClick={() => setIsExpanded(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 48,
              backgroundColor: "rgba(0,0,0,0.35)",
              opacity: isExpanded ? 1 : 0,
              pointerEvents: isExpanded ? "auto" : "none",
              transition: "opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />

          {/* Bottom sheet */}
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 49,
              borderRadius: "22px 22px 0 0",
              backgroundColor: "var(--bg-surface)",
              borderTop: "1px solid var(--border-subtle)",
              borderLeft: "1px solid var(--border-dim)",
              borderRight: "1px solid var(--border-dim)",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.65)",
              transform: isExpanded ? "translateY(0)" : "translateY(100%)",
              transition: "transform 340ms cubic-bezier(0.22, 1, 0.36, 1)",
              maxHeight: "56vh",
              display: "flex",
              flexDirection: "column",
              paddingBottom: "max(0px, env(safe-area-inset-bottom))",
            }}
          >
            {/* Sticky sheet header */}
            <div
              style={{
                flexShrink: 0,
                padding: "8px 12px 8px",
                borderBottom: "1px solid var(--border-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              {/* Drag pill */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 32,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "var(--border-strong)",
                }}
              />
              {/* Tab row when position exists, plain label otherwise */}
              {hasPosition ? (
                <div style={{ display: "flex", gap: 4, paddingTop: 6 }}>
                  {(["trade", "position"] as const).map((v) => {
                    const active = view === v;
                    const label = v === "trade"
                      ? (zh ? "下单" : "Trade")
                      : (zh ? "持仓" : "Position");
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setView(v)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 100,
                          border: `1px solid ${active ? "var(--border-gold)" : "var(--border-subtle)"}`,
                          backgroundColor: active ? "var(--gold-dim)" : "transparent",
                          color: active ? "var(--gold)" : "var(--text-dim)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          fontWeight: 700,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                          transition: "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p
                  style={{
                    paddingTop: 6,
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                  }}
                >
                  {zh ? "下单" : "Place Trade"}
                </p>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 12px",
                  paddingTop: 10,
                  borderRadius: 100,
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                }}
              >
                <ChevronDown style={{ width: 13, height: 13 }} />
                {zh ? "收起" : "Collapse"}
              </button>
            </div>

            {/* Sheet content — scrollable */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
              {view === "trade" ? (
                <TradeForm
                  key={formKey}
                  {...props}
                  compact
                  onTradeSuccess={handleTradeSuccess}
                />
              ) : (
                <MarketPositionPanel
                  {...sharedPositionProps}
                  compact
                  onBuyAgain={handleBuyAgain}
                />
              )}
            </div>
          </div>

          {/* ── Collapsed button — right-anchored rectangle ───────────────── */}
          <button
            type="button"
            onClick={() => { if (hasPosition) setView("position"); setIsExpanded(true); }}
            className="lg:hidden"
            style={{
              position: "fixed",
              right: 12,
              bottom: "calc(64px + 14px + env(safe-area-inset-bottom))",
              zIndex: 47,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              width: 72,
              padding: "10px 0",
              borderRadius: 16,
              backgroundColor: "rgba(7,8,9,0.94)",
              border: "1px solid var(--border-subtle)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
              cursor: "pointer",
              opacity: isExpanded ? 0 : 1,
              pointerEvents: isExpanded ? "none" : "auto",
              transition: "opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            aria-label={zh ? "下单" : "Trade"}
          >
            {hasPosition ? (
              /* Position open state */
              <>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "var(--teal)",
                    boxShadow: "0 0 8px var(--teal)",
                    animation: "pulseDot 1.4s ease-in-out infinite",
                  }}
                />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 700, color: "var(--teal)", letterSpacing: "0.04em" }}>
                  {zh ? "持仓" : "OPEN"}
                </span>
                <ChevronUp style={{ width: 13, height: 13, color: "var(--text-dim)" }} />
              </>
            ) : (
              /* Trade state — stacked UP / DOWN prices */
              <>
                {yesP != null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "var(--teal)", letterSpacing: "-0.01em" }}>
                    ↑{(yesP * 100).toFixed(0)}¢
                  </span>
                )}
                {noP != null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "var(--rose)", letterSpacing: "-0.01em" }}>
                    ↓{(noP * 100).toFixed(0)}¢
                  </span>
                )}
                <ChevronUp style={{ width: 13, height: 13, color: "var(--text-dim)", marginTop: 1 }} />
              </>
            )}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
