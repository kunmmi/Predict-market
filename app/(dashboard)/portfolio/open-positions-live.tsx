"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart2, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import type { T } from "@/lib/i18n/translations";
import type { PortfolioPosition } from "@/lib/services/portfolio-data";
import { useVisibilityPoll } from "@/lib/hooks/use-visibility-poll";
import { SellPositionControl } from "./sell-position-control";

type Props = {
  initialPositions: PortfolioPosition[];
  locale: string;
  t: T["portfolio"];
};

type PositionsResponse = {
  success: boolean;
  positions?: PortfolioPosition[];
};

function isExpiredShortDuration(position: PortfolioPosition): boolean {
  return (
    position.durationMinutes != null &&
    new Date(position.marketCloseAt).getTime() < Date.now() &&
    position.marketStatus === "active"
  );
}

export function OpenPositionsLive({ initialPositions, locale, t }: Props) {
  const [positions, setPositions] = useState(initialPositions);
  const settlingMarketsRef = useRef<Set<string>>(new Set());

  const fetchPositions = useCallback(async (): Promise<PortfolioPosition[] | null> => {
    try {
      const response = await fetch("/api/portfolio/positions", { method: "GET", cache: "no-store" });
      if (!response.ok) return null;
      const json = (await response.json()) as PositionsResponse;
      const nextPositions = json.positions ?? [];
      setPositions(nextPositions);
      return nextPositions;
    } catch {
      return null;
    }
  }, []);

  const settleExpiredMarkets = useCallback(
    async (currentPositions: PortfolioPosition[]) => {
      const marketIds = Array.from(
        new Set(
          currentPositions
            .filter(isExpiredShortDuration)
            .map((p) => p.marketId)
            .filter((id) => !settlingMarketsRef.current.has(id)),
        ),
      );
      if (marketIds.length === 0) return;
      marketIds.forEach((id) => settlingMarketsRef.current.add(id));
      await Promise.all(
        marketIds.map(async (id) => {
          try { await fetch(`/api/markets/${id}/auto-settle`, { method: "POST" }); } catch { /* ignore */ }
        }),
      );
      const refreshed = await fetchPositions();
      if (!refreshed) return;
      const stillExpired = new Set(refreshed.filter(isExpiredShortDuration).map((p) => p.marketId));
      marketIds.forEach((id) => { if (!stillExpired.has(id)) settlingMarketsRef.current.delete(id); });
    },
    [fetchPositions],
  );

  useEffect(() => { setPositions(initialPositions); }, [initialPositions]);

  const poll = useCallback(async () => {
    const next = await fetchPositions();
    if (next) await settleExpiredMarkets(next);
  }, [fetchPositions, settleExpiredMarkets]);

  useEffect(() => { void poll(); }, [poll]);
  useVisibilityPoll(poll, 15_000);

  const rows = useMemo(
    () =>
      positions.map((position) => {
        const yesUnits = Number(position.yesUnits);
        const noUnits  = Number(position.noUnits);
        const avgYesPrice  = position.avgYesPrice  != null ? Number(position.avgYesPrice)  : null;
        const avgNoPrice   = position.avgNoPrice   != null ? Number(position.avgNoPrice)   : null;
        const latestYesPrice = position.latestYesPrice != null ? Number(position.latestYesPrice) : 0;
        const latestNoPrice  = position.latestNoPrice  != null ? Number(position.latestNoPrice)  : 0;
        const costBasis    = yesUnits * (avgYesPrice ?? 0) + noUnits * (avgNoPrice ?? 0);
        const currentValue = yesUnits * latestYesPrice + noUnits * latestNoPrice;
        return {
          position,
          totalValue: currentValue,
          unrealizedPnl: currentValue - costBasis,
          pnlLocked: avgYesPrice == null && avgNoPrice == null,
          settling: isExpiredShortDuration(position),
        };
      }),
    [positions],
  );

  return (
    <Card>
      <CardHeader style={{ paddingBottom: 12 }}>
        <CardTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>{t.open_positions}</span>
          {/* Count badge */}
          <span style={{
            borderRadius: 100, padding: "1px 8px",
            fontFamily: "var(--font-mono)", fontSize: "0.625rem",
            fontWeight: 600, color: "var(--text-dim)",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}>
            {positions.length}
          </span>
          {/* Live badge */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            borderRadius: 100, padding: "2px 8px",
            fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
            fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            backgroundColor: "var(--teal-dim)",
            border: "1px solid rgba(13,184,145,0.2)",
            color: "var(--teal)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--teal)", flexShrink: 0, animation: "pulseDot 1.5s ease-in-out infinite" }} />
            Live
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem 1rem", textAlign: "center" }}>
            <BarChart2 style={{ width: 32, height: 32, color: "var(--text-dim)", marginBottom: 12 }} />
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>{t.no_positions}</p>
            <Link
              href="/markets"
              style={{
                marginTop: 16, display: "inline-flex", alignItems: "center", gap: 4,
                fontFamily: "var(--font-sans)", fontSize: "0.75rem",
                fontWeight: 600, color: "var(--gold)", textDecoration: "none",
              }}
              className="hover:opacity-80"
            >
              {t.browse_markets} <ChevronRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  {[
                    { label: t.col_market,       align: "left"  },
                    { label: t.col_yes_units,    align: "right" },
                    { label: t.col_no_units,     align: "right" },
                    { label: t.col_current_yes,  align: "right", hide: true },
                    { label: t.col_est_value,    align: "right" },
                    { label: t.col_unrealized_pnl, align: "right" },
                    { label: t.sell,             align: "right" },
                  ].map(({ label, align, hide }) => (
                    <th
                      key={label}
                      className={hide ? "hidden sm:table-cell" : ""}
                      style={{
                        padding: "0 12px 10px",
                        textAlign: align as "left" | "right",
                        fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                        fontWeight: 700, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: "var(--text-dim)",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ position, totalValue, unrealizedPnl, pnlLocked, settling }) => (
                  <tr
                    key={position.id}
                    style={{ borderBottom: "1px solid var(--border-dim)", transition: "background-color 150ms ease" }}
                    className="hover:bg-[var(--bg-elevated)]"
                  >
                    <td style={{ padding: "12px" }}>
                      <Link
                        href={`/markets/${position.marketSlug}`}
                        style={{
                          fontFamily: "var(--font-sans)", fontSize: "0.875rem",
                          fontWeight: 500, color: "var(--text-primary)",
                          textDecoration: "none", display: "block",
                        }}
                        className="hover:text-[var(--gold)]"
                      >
                        {locale === "zh" && position.marketTitleZh ? position.marketTitleZh : position.marketTitle}
                      </Link>
                      {position.outcomeId && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4,
                          fontFamily: "var(--font-sans)", fontSize: "0.6875rem",
                          fontWeight: 600, color: "var(--gold)",
                          backgroundColor: "rgba(232,160,32,0.08)",
                          border: "1px solid rgba(232,160,32,0.2)",
                          borderRadius: 100, padding: "1px 8px",
                        }}>
                          {locale === "zh" && position.outcomeLabelZh ? position.outcomeLabelZh : position.outcomeLabel}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--teal)" }}>
                      {position.outcomeId ? `$${formatDecimal(position.yesUnits, 2)}` : formatDecimal(position.yesUnits, 4)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--rose)" }}>
                      {position.outcomeId ? "—" : formatDecimal(position.noUnits, 4)}
                    </td>
                    <td className="hidden sm:table-cell" style={{ padding: "12px", textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--teal)" }}>
                      {position.latestYesPrice != null ? `$${formatDecimal(position.latestYesPrice, 4)}` : "—"}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                      ${formatDecimal(totalValue, 4)}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      {settling ? (
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", fontWeight: 500, color: "var(--gold)" }}>{t.expired_short_duration}</span>
                      ) : pnlLocked ? (
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--text-dim)" }}>{t.pnl_locked}</span>
                      ) : (
                        <span style={{
                          fontFamily: "var(--font-mono)", fontWeight: 600, fontVariantNumeric: "tabular-nums",
                          color: unrealizedPnl > 0 ? "var(--teal)" : unrealizedPnl < 0 ? "var(--rose)" : "var(--text-dim)",
                        }}>
                          {unrealizedPnl > 0 ? "+" : ""}${formatDecimal(unrealizedPnl, 2)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", verticalAlign: "top" }}>
                      {position.outcomeId ? (
                        <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "var(--text-dim)" }}>
                          {locale === "zh" ? "待结算" : "Awaiting settlement"}
                        </span>
                      ) : (
                        <SellPositionControl
                          positionId={position.id}
                          marketStatus={position.marketStatus}
                          yesUnits={position.yesUnits}
                          noUnits={position.noUnits}
                          latestYesPrice={position.latestYesPrice}
                          latestNoPrice={position.latestNoPrice}
                          locale={locale as "en" | "zh"}
                          t={t}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
