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
              backgroundColor: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
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
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              paddingBottom: "max(0px, env(safe-area-inset-bottom))",
            }}
          >
            {/* Sticky sheet header */}
            <div
              style={{
                flexShrink: 0,
                padding: "10px 16px 12px",
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
                {view === "trade"
                  ? (zh ? "下单" : "Place Trade")
                  : (zh ? "我的持仓" : "Your Position")}
              </p>
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
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
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

          {/* ── Collapsed pill — always floats above bottom nav ────────────── */}
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: "calc(64px + env(safe-area-inset-bottom))",
              zIndex: 47,
              padding: "0 12px 8px",
              opacity: isExpanded ? 0 : 1,
              pointerEvents: isExpanded ? "none" : "auto",
              transition: "opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                gap: 10,
                height: 52,
                padding: "0 14px",
                borderRadius: 14,
                backgroundColor: "rgba(7,8,9,0.94)",
                border: "1px solid var(--border-subtle)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: "0 4px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
                cursor: "pointer",
              }}
            >
              {hasPosition && view === "position" ? (
                /* ── Position indicator ── */
                <>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "var(--teal)",
                      boxShadow: "0 0 8px var(--teal)",
                      flexShrink: 0,
                      animation: "pulseDot 1.4s ease-in-out infinite",
                    }}
                  />
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--teal)" }}>
                      {zh ? "持仓已开立" : "Position open"}
                    </p>
                    <p style={{ marginTop: 1, fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      {zh ? "点击查看 · 卖出 · 加仓" : "Tap to view · sell · buy more"}
                    </p>
                  </div>
                  <ChevronUp style={{ width: 15, height: 15, color: "var(--text-dim)", flexShrink: 0 }} />
                </>
              ) : (
                /* ── Trade price chips ── */
                <>
                  <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 8 }}>
                    {yesP != null && (
                      <div
                        style={{
                          padding: "4px 10px",
                          borderRadius: 100,
                          border: "1px solid rgba(13,184,145,0.35)",
                          backgroundColor: "rgba(13,184,145,0.1)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.875rem",
                          fontWeight: 700,
                          color: "var(--teal)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {upLabel} {(yesP * 100).toFixed(0)}¢
                      </div>
                    )}
                    {noP != null && (
                      <div
                        style={{
                          padding: "4px 10px",
                          borderRadius: 100,
                          border: "1px solid rgba(232,68,90,0.35)",
                          backgroundColor: "rgba(232,68,90,0.1)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.875rem",
                          fontWeight: 700,
                          color: "var(--rose)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {downLabel} {(noP * 100).toFixed(0)}¢
                      </div>
                    )}
                    {hasPosition && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          backgroundColor: "var(--teal)",
                          boxShadow: "0 0 6px var(--teal)",
                          flexShrink: 0,
                        }}
                        title={zh ? "持仓中" : "Position open"}
                      />
                    )}
                  </div>
                  <ChevronUp style={{ width: 15, height: 15, color: "var(--text-dim)", flexShrink: 0 }} />
                </>
              )}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
