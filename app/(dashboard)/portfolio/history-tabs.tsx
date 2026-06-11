"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { sideLabel } from "@/lib/i18n/labels";
import { effectivePnl } from "@/lib/helpers/pnl";
import type { PortfolioPosition, PortfolioTrade } from "@/lib/services/portfolio-data";
import type { Locale } from "@/lib/i18n/translations";

type Props = {
  settledPositions: PortfolioPosition[];
  recentTrades: PortfolioTrade[];
  locale: Locale;
  dateLocale: string;
};

export function HistoryTabs({ settledPositions, recentTrades, locale, dateLocale }: Props) {
  const [tab, setTab] = useState<"rounds" | "trades">("rounds");
  const zh = locale === "zh";

  return (
    <Card>
      {/* Tab header */}
      <CardHeader style={{ paddingBottom: 0, paddingTop: 16, paddingLeft: 16, paddingRight: 16 }}>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-subtle)" }}>
          {(["rounds", "trades"] as const).map((t) => {
            const active = tab === t;
            const label = t === "rounds" ? (zh ? "历史战绩" : "Round History") : (zh ? "交易记录" : "Recent Trades");
            const count = t === "rounds" ? settledPositions.length : recentTrades.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 16px",
                  fontFamily: "var(--font-sans)", fontSize: "0.875rem",
                  fontWeight: 600, cursor: "pointer",
                  border: "none", background: "none",
                  borderBottom: `2px solid ${active ? "var(--gold)" : "transparent"}`,
                  marginBottom: -1,
                  color: active ? "var(--text-primary)" : "var(--text-dim)",
                  transition: "color 150ms ease, border-color 150ms ease",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
                className={active ? "" : "hover:text-[var(--text-secondary)]"}
              >
                {label}
                <span style={{
                  borderRadius: 100, padding: "1px 7px",
                  fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                  fontWeight: 600, color: "var(--text-dim)",
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border-dim)",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent style={{ padding: 16 }}>
        {/* ── Round History ── */}
        {tab === "rounds" && (
          settledPositions.length === 0 ? (
            <p style={{ padding: "2rem 0", textAlign: "center", fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--text-dim)" }}>
              {zh ? "暂无历史战绩" : "No completed rounds yet — start trading!"}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {settledPositions.map((pos) => {
                const pnl = effectivePnl(pos);
                const isWin  = pnl > 0;
                const isVoid = pos.resolutionOutcome === "void" || pos.resolutionOutcome === "cancelled" || pos.status === "cancelled";
                const playedYes = parseFloat(pos.yesUnits) > 0;
                const playedNo  = parseFloat(pos.noUnits)  > 0;
                const isShort = pos.durationMinutes != null;
                const isMulti = pos.marketType === "multi";

                let directionLabel = "";
                if (isMulti) {
                  // For multi markets, direction = the outcome they backed
                  directionLabel = (zh && pos.outcomeLabelZh) ? pos.outcomeLabelZh : (pos.outcomeLabel ?? "");
                } else if (isShort) {
                  if (playedYes && playedNo) directionLabel = "UP + DOWN";
                  else if (playedYes) directionLabel = zh ? "看涨 UP" : "UP";
                  else if (playedNo)  directionLabel = zh ? "看跌 DOWN" : "DOWN";
                } else {
                  if (playedYes) directionLabel = sideLabel("yes", locale);
                  if (playedNo)  directionLabel = sideLabel("no",  locale);
                }

                const roundResultLabel = isMulti
                  ? null  // winner already shown inline via isWin styling
                  : pos.roundResult
                    ? pos.roundResult.toUpperCase()
                    : pos.resolutionOutcome
                      ? pos.resolutionOutcome.toUpperCase()
                      : null;

                const rowBg     = isVoid ? "var(--bg-elevated)" : isWin ? "var(--teal-dim)"  : "var(--rose-dim)";
                const rowBorder = isVoid ? "var(--border-subtle)" : isWin ? "rgba(13,184,145,0.2)" : "rgba(232,68,90,0.2)";
                const iconBg    = isVoid ? "var(--bg-elevated)" : isWin ? "rgba(13,184,145,0.2)" : "rgba(232,68,90,0.2)";
                const pnlColor  = isVoid ? "var(--text-secondary)" : isWin ? "var(--teal)" : "var(--rose)";

                return (
                  <div
                    key={pos.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${rowBorder}`,
                      backgroundColor: rowBg,
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Icon */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                        backgroundColor: iconBg,
                      }}>
                        {isVoid ? (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-dim)" }}>—</span>
                        ) : isWin ? (
                          <TrendingUp style={{ width: 14, height: 14, color: "var(--teal)" }} />
                        ) : (
                          <TrendingDown style={{ width: 14, height: 14, color: "var(--rose)" }} />
                        )}
                      </div>

                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          {pos.assetSymbol && (
                            <span style={{
                              fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                              fontWeight: 700, letterSpacing: "0.08em",
                              padding: "1px 6px", borderRadius: 4,
                              backgroundColor: "var(--bg-elevated)",
                              border: "1px solid var(--border-subtle)",
                              color: "var(--text-secondary)",
                            }}>
                              {pos.assetSymbol}
                            </span>
                          )}
                          {directionLabel && (
                            <span style={{
                              fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                              fontWeight: 700, letterSpacing: "0.06em",
                              padding: "1px 6px", borderRadius: 4,
                              backgroundColor: isMulti ? "rgba(232,160,32,0.12)" : playedYes ? "rgba(13,184,145,0.15)" : "rgba(232,68,90,0.15)",
                              border: `1px solid ${isMulti ? "rgba(232,160,32,0.25)" : playedYes ? "rgba(13,184,145,0.2)" : "rgba(232,68,90,0.2)"}`,
                              color: isMulti ? "var(--gold)" : playedYes ? "var(--teal)" : "var(--rose)",
                            }}>
                              {directionLabel}
                            </span>
                          )}
                          {roundResultLabel && (
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "var(--text-dim)" }}>
                              → {roundResultLabel}
                            </span>
                          )}
                        </div>
                        <p style={{ marginTop: 3, fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "var(--text-dim)" }}>
                          {new Date(pos.marketCloseAt).toLocaleDateString(dateLocale, {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    <p style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.9375rem",
                      fontWeight: 700, fontVariantNumeric: "tabular-nums",
                      color: pnlColor,
                    }}>
                      {isVoid
                        ? (zh ? "已退款" : "Refunded")
                        : `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Recent Trades ── */}
        {tab === "trades" && (
          recentTrades.length === 0 ? (
            <p style={{ padding: "2rem 0", textAlign: "center", fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--text-dim)" }}>
              {zh ? "暂无交易记录" : "No trades yet."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {[
                      { label: zh ? "市场" : "Market",   align: "left"  },
                      { label: zh ? "方向" : "Side",     align: "left"  },
                      { label: zh ? "金额" : "Amount",   align: "right" },
                      { label: zh ? "价格" : "Price",    align: "right", hide: "sm" },
                      { label: zh ? "份额" : "Units",    align: "right", hide: "sm" },
                      { label: zh ? "日期" : "Date",     align: "right", hide: "md" },
                    ].map(({ label, align, hide }) => (
                      <th
                        key={label}
                        className={hide === "sm" ? "hidden sm:table-cell" : hide === "md" ? "hidden md:table-cell" : ""}
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
                  {recentTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      style={{ borderBottom: "1px solid var(--border-dim)", transition: "background-color 150ms ease" }}
                      className="hover:bg-[var(--bg-elevated)]"
                    >
                      <td style={{ padding: "11px 12px" }}>
                        <Link
                          href={`/markets/${trade.marketSlug}`}
                          style={{
                            fontFamily: "var(--font-sans)", fontSize: "0.875rem",
                            fontWeight: 500, color: "var(--text-primary)", textDecoration: "none",
                          }}
                          className="hover:text-[var(--gold)]"
                        >
                          {locale === "zh" && trade.marketTitleZh ? trade.marketTitleZh : trade.marketTitle}
                        </Link>
                      </td>
                      <td style={{ padding: "11px 12px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "2px 8px", borderRadius: 100,
                          fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                          fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                          backgroundColor: trade.side === "yes" ? "var(--teal-dim)" : "var(--rose-dim)",
                          border: `1px solid ${trade.side === "yes" ? "rgba(13,184,145,0.2)" : "rgba(232,68,90,0.2)"}`,
                          color: trade.side === "yes" ? "var(--teal)" : "var(--rose)",
                        }}>
                          {sideLabel(trade.side, locale)}
                        </span>
                      </td>
                      <td style={{ padding: "11px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                        ${formatDecimal(trade.amount, 2)}
                      </td>
                      <td className="hidden sm:table-cell" style={{ padding: "11px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-dim)" }}>
                        ${formatDecimal(trade.price, 4)}
                      </td>
                      <td className="hidden sm:table-cell" style={{ padding: "11px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                        {formatDecimal(trade.positionUnits, 4)}
                      </td>
                      <td className="hidden md:table-cell" style={{ padding: "11px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                        {new Date(trade.createdAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
