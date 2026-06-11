"use client";

import { useEffect, useState, useCallback } from "react";
import type { MarketOutcomeItem } from "@/lib/services/market-data";
import type { Locale } from "@/lib/i18n/translations";
import { MultiTradeForm } from "./multi-trade-form";

type Props = {
  marketId: string;
  initialOutcomes: MarketOutcomeItem[];
  marketStatus: string;
  locale: Locale;
  walletBalance: number;
};

const POLL_INTERVAL = 30_000; // 30s

export function LiveOutcomes({ marketId, initialOutcomes, marketStatus, locale, walletBalance }: Props) {
  const zh = locale === "zh";
  const [outcomes, setOutcomes] = useState<MarketOutcomeItem[]>(initialOutcomes);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOutcomes = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/outcomes`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as MarketOutcomeItem[];
      if (Array.isArray(data) && data.length > 0) {
        setOutcomes(data);
        setLastUpdated(new Date());
      }
    } catch { /* silent */ }
  }, [marketId]);

  // Poll while tab is visible, pause when hidden
  useEffect(() => {
    if (marketStatus !== "active") return;
    const id = setInterval(() => {
      if (!document.hidden) void fetchOutcomes();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchOutcomes, marketStatus]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-dim)" }}>
          {zh ? "选项 · 当前赔率" : "OUTCOMES · CURRENT ODDS"}
        </p>
        {marketStatus === "active" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "var(--teal)", animation: "pulseDot 1.5s ease-in-out infinite", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.08em", color: "var(--teal)" }}>
              {zh ? "实时" : "LIVE"}
              {lastUpdated && (
                <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 4 }}>
                  · {zh ? "更新于" : "updated"} {lastUpdated.toLocaleTimeString(zh ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {outcomes.map((o, i) => {
          const pct = Math.round(o.price * 100);
          const label = (zh && o.labelZh) ? o.labelZh : o.label;
          const isWon  = o.isWinner === true;
          const isLost = o.isWinner === false;
          return (
            <div key={o.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: isWon ? "rgba(13,184,145,0.06)" : "var(--bg-elevated)",
              border: `1px solid ${isWon ? "rgba(13,184,145,0.2)" : isLost ? "rgba(255,255,255,0.03)" : "var(--border-subtle)"}`,
              opacity: isLost ? 0.45 : 1,
              transition: "background-color 300ms ease, border-color 300ms ease",
            }}>
              <span style={{
                width: 22, height: 22, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700,
                color: isWon ? "var(--teal)" : i === 0 ? "var(--gold)" : "var(--text-dim)",
                backgroundColor: isWon ? "rgba(13,184,145,0.15)" : i === 0 ? "rgba(232,160,32,0.1)" : "rgba(255,255,255,0.04)",
                borderRadius: "50%",
                border: `1px solid ${isWon ? "rgba(13,184,145,0.3)" : i === 0 ? "rgba(232,160,32,0.3)" : "rgba(255,255,255,0.07)"}`,
              }}>
                {isWon ? "✓" : i + 1}
              </span>
              <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: isWon ? 600 : 400, color: isWon ? "var(--teal)" : "var(--text-primary)" }}>
                {label}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <div style={{ width: 80, height: 5, borderRadius: 3, backgroundColor: "var(--bg-surface)", overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 3,
                    backgroundColor: isWon ? "var(--teal)" : i === 0 ? "var(--gold)" : "rgba(255,255,255,0.2)",
                    transition: "width 500ms ease",
                  }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: isWon ? "var(--teal)" : i === 0 ? "var(--gold)" : "var(--text-secondary)", width: 36, textAlign: "right" }}>
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {marketStatus === "active" && outcomes.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
          <MultiTradeForm
            marketId={marketId}
            outcomes={outcomes}
            locale={locale}
            walletBalance={walletBalance}
          />
        </div>
      )}
    </div>
  );
}
