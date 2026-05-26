"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { sideLabel } from "@/lib/i18n/labels";
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
      <CardHeader className="pb-0 pt-4 px-4">
        <div className="flex gap-1 border-b border-slate-100">
          <button
            onClick={() => setTab("rounds")}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === "rounds"
                ? "border-yellow-500 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            {zh ? "历史战绩" : "Round History"}
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {settledPositions.length}
            </span>
          </button>
          <button
            onClick={() => setTab("trades")}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === "trades"
                ? "border-yellow-500 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            {zh ? "交易记录" : "Recent Trades"}
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {recentTrades.length}
            </span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 px-4 pb-4">
        {/* ── Round History ── */}
        {tab === "rounds" && (
          settledPositions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {zh ? "暂无历史战绩" : "No completed rounds yet — start trading!"}
            </p>
          ) : (
            <div className="space-y-2">
              {settledPositions.map((pos) => {
                const pnl = parseFloat(pos.pnlAmount);
                const isWin = pnl > 0;
                const isVoid = pos.resolutionOutcome === "void" || pos.resolutionOutcome === "cancelled";
                const isShort = pos.durationMinutes != null;
                const playedYes = parseFloat(pos.yesUnits) > 0;
                const playedNo = parseFloat(pos.noUnits) > 0;

                let directionLabel = "";
                if (isShort) {
                  if (playedYes && playedNo) directionLabel = "UP + DOWN";
                  else if (playedYes) directionLabel = zh ? "看涨 UP" : "UP";
                  else if (playedNo) directionLabel = zh ? "看跌 DOWN" : "DOWN";
                } else {
                  if (playedYes) directionLabel = sideLabel("yes", locale);
                  if (playedNo) directionLabel = sideLabel("no", locale);
                }

                const roundResultLabel = pos.roundResult
                  ? pos.roundResult.toUpperCase()
                  : pos.resolutionOutcome
                    ? pos.resolutionOutcome.toUpperCase()
                    : null;

                return (
                  <div
                    key={pos.id}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      isVoid
                        ? "border-slate-200 bg-slate-50"
                        : isWin
                          ? "border-green-200 bg-green-50"
                          : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isVoid ? "bg-slate-200" : isWin ? "bg-green-200" : "bg-red-200"
                      }`}>
                        {isVoid ? (
                          <span className="text-xs font-bold text-slate-500">—</span>
                        ) : isWin ? (
                          <TrendingUp className="h-4 w-4 text-green-700" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {pos.assetSymbol && (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                              {pos.assetSymbol}
                            </span>
                          )}
                          {directionLabel && (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              playedYes ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"
                            }`}>
                              {directionLabel}
                            </span>
                          )}
                          {roundResultLabel && (
                            <span className="text-[10px] font-medium text-slate-500">
                              → {roundResultLabel}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {new Date(pos.marketCloseAt).toLocaleDateString(dateLocale, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <p className={`text-base font-bold tabular-nums ${
                      isVoid ? "text-slate-500" : isWin ? "text-green-700" : "text-red-600"
                    }`}>
                      {isVoid
                        ? (zh ? "已退款" : "Refunded")
                        : `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(2)}`}
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
            <p className="py-8 text-center text-sm text-slate-400">
              {zh ? "暂无交易记录" : "No trades yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-3 text-left">{zh ? "市场" : "Market"}</th>
                    <th className="pb-3 pr-3 text-left">{zh ? "方向" : "Side"}</th>
                    <th className="pb-3 pr-3 text-right">{zh ? "金额" : "Amount"}</th>
                    <th className="hidden pb-3 pr-3 text-right sm:table-cell">{zh ? "价格" : "Price"}</th>
                    <th className="hidden pb-3 pr-3 text-right sm:table-cell">{zh ? "份额" : "Units"}</th>
                    <th className="hidden pb-3 text-right md:table-cell">{zh ? "日期" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => (
                    <tr key={trade.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 pr-3">
                        <Link
                          href={`/markets/${trade.marketSlug}`}
                          className="font-medium text-slate-800 hover:text-yellow-600 hover:underline"
                        >
                          {locale === "zh" && trade.marketTitleZh ? trade.marketTitleZh : trade.marketTitle}
                        </Link>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          trade.side === "yes" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {sideLabel(trade.side, locale)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-700">
                        ${formatDecimal(trade.amount, 2)}
                      </td>
                      <td className="hidden py-3 pr-3 text-right font-mono tabular-nums text-slate-500 sm:table-cell">
                        ${formatDecimal(trade.price, 4)}
                      </td>
                      <td className="hidden py-3 pr-3 text-right font-mono tabular-nums text-slate-700 sm:table-cell">
                        {formatDecimal(trade.positionUnits, 4)}
                      </td>
                      <td className="hidden py-3 text-right text-xs text-slate-400 md:table-cell">
                        {new Date(trade.createdAt).toLocaleDateString(dateLocale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
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
