export const dynamic = "force-dynamic";

import Link from "next/link";
import { DollarSign, BarChart2, TrendingUp, TrendingDown, Trophy } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { getPortfolioData } from "@/lib/services/portfolio-data";
import { getWalletData } from "@/lib/services/wallet-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { sideLabel, statusLabel } from "@/lib/i18n/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { OpenPositionsLive } from "./open-positions-live";
import { LimitOrdersPanel } from "./limit-orders-panel";

export default async function PortfolioPage() {
  const { profile } = await requireUser();
  const [portfolio, walletData] = await Promise.all([
    getPortfolioData(profile.id),
    getWalletData(profile.id),
  ]);
  const locale = getLocale();
  const t = getT(locale).portfolio;
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";

  const { openPositions, settledPositions, recentTrades } = portfolio;

  const estValue = openPositions.reduce((sum, pos) => {
    const yesVal =
      parseFloat(pos.yesUnits) * (pos.latestYesPrice != null ? parseFloat(pos.latestYesPrice) : 0);
    const noVal =
      parseFloat(pos.noUnits) * (pos.latestNoPrice != null ? parseFloat(pos.latestNoPrice) : 0);
    return sum + yesVal + noVal;
  }, 0);

  const totalPnl = settledPositions.reduce((sum, pos) => sum + parseFloat(pos.pnlAmount), 0);
  const wins = settledPositions.filter((p) => parseFloat(p.pnlAmount) > 0).length;
  const losses = settledPositions.filter((p) => parseFloat(p.pnlAmount) < 0).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">{t.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t.available_balance}</p>
                <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
                  ${formatDecimal(walletData.wallet?.availableBalance, 2)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t.open_positions}</p>
                <p className="mt-1.5 text-2xl font-bold text-slate-900">{openPositions.length}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100">
                <BarChart2 className="h-4 w-4 text-yellow-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t.est_value}</p>
                <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
                  ${formatDecimal(estValue, 2)}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {locale === "zh" ? "历史盈亏" : "Total P&L"}
                </p>
                <p className={`mt-1.5 text-2xl font-bold tabular-nums ${totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {totalPnl >= 0 ? "+" : ""}${formatDecimal(Math.abs(totalPnl), 2)}
                </p>
                {settledPositions.length > 0 && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {wins}W – {losses}L
                  </p>
                )}
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${totalPnl >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                <Trophy className={`h-4 w-4 ${totalPnl >= 0 ? "text-green-600" : "text-red-500"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <OpenPositionsLive
        initialPositions={openPositions}
        locale={locale}
        t={t}
      />

      <LimitOrdersPanel locale={locale} t={t} />

      {/* Round History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {locale === "zh" ? "历史战绩" : "Round History"}
            {settledPositions.length > 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {settledPositions.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settledPositions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {locale === "zh" ? "暂无历史战绩" : "No completed rounds yet — start trading!"}
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

                // Direction label for short-duration markets
                let directionLabel = "";
                if (isShort) {
                  if (playedYes && playedNo) directionLabel = locale === "zh" ? "UP + DOWN" : "UP + DOWN";
                  else if (playedYes) directionLabel = locale === "zh" ? "看涨 UP" : "UP";
                  else if (playedNo) directionLabel = locale === "zh" ? "看跌 DOWN" : "DOWN";
                } else {
                  if (playedYes) directionLabel = sideLabel("yes", locale);
                  if (playedNo) directionLabel = sideLabel("no", locale);
                }

                // Round result label
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
                      {/* Win/loss icon */}
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

                    <div className="text-right">
                      <p className={`text-base font-bold tabular-nums ${
                        isVoid ? "text-slate-500" : isWin ? "text-green-700" : "text-red-600"
                      }`}>
                        {isVoid ? "Refunded" : `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(2)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {t.recent_trades}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {recentTrades.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentTrades.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">{t.no_trades}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-3 text-left">{t.col_market}</th>
                    <th className="pb-3 pr-3 text-left">{t.col_side}</th>
                    <th className="pb-3 pr-3 text-right">{t.col_amount}</th>
                    <th className="hidden pb-3 pr-3 text-right sm:table-cell">{t.col_price}</th>
                    <th className="hidden pb-3 pr-3 text-right sm:table-cell">{t.col_units}</th>
                    <th className="hidden pb-3 pr-3 text-right md:table-cell">{t.col_fee}</th>
                    <th className="hidden pb-3 text-right md:table-cell">{t.col_date}</th>
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
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            trade.side === "yes"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
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
                      <td className="hidden py-3 pr-3 text-right font-mono tabular-nums text-slate-400 md:table-cell">
                        ${formatDecimal(trade.feeAmount, 4)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
