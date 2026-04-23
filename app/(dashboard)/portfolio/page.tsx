import Link from "next/link";
import { DollarSign, BarChart2, TrendingUp, ChevronRight } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { getPortfolioData } from "@/lib/services/portfolio-data";
import { getWalletData } from "@/lib/services/wallet-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { sideLabel, statusLabel } from "@/lib/i18n/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">{t.subtitle}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
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
      </div>

      {/* Open Positions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {t.open_positions}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {openPositions.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <TrendingUp className="mb-3 h-8 w-8 text-slate-200" />
              <p className="text-sm font-medium text-slate-600">{t.no_positions}</p>
              <Link
                href="/markets"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-900 underline underline-offset-4 hover:text-yellow-600"
              >
                {t.browse_markets} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-3 text-left">{t.col_market}</th>
                    <th className="pb-3 pr-3 text-right">{t.col_yes_units}</th>
                    <th className="pb-3 pr-3 text-right">{t.col_no_units}</th>
                    <th className="hidden pb-3 pr-3 text-right sm:table-cell">{t.col_current_yes}</th>
                    <th className="pb-3 text-right">{t.col_est_value}</th>
                  </tr>
                </thead>
                <tbody>
                  {openPositions.map((pos) => {
                    const yesVal =
                      parseFloat(pos.yesUnits) *
                      (pos.latestYesPrice != null ? parseFloat(pos.latestYesPrice) : 0);
                    const noVal =
                      parseFloat(pos.noUnits) *
                      (pos.latestNoPrice != null ? parseFloat(pos.latestNoPrice) : 0);
                    const totalVal = yesVal + noVal;
                    return (
                      <tr key={pos.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pr-3">
                          <Link
                            href={`/markets/${pos.marketSlug}`}
                            className="font-medium text-slate-800 hover:text-yellow-600 hover:underline"
                          >
                            {locale === "zh" && pos.marketTitleZh ? pos.marketTitleZh : pos.marketTitle}
                          </Link>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-green-700">
                          {formatDecimal(pos.yesUnits, 4)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-red-600">
                          {formatDecimal(pos.noUnits, 4)}
                        </td>
                        <td className="hidden py-3 pr-3 text-right font-mono tabular-nums text-green-700 sm:table-cell">
                          {pos.latestYesPrice != null ? `$${formatDecimal(pos.latestYesPrice, 4)}` : "—"}
                        </td>
                        <td className="py-3 text-right font-mono font-semibold tabular-nums text-slate-800">
                          ${formatDecimal(totalVal, 4)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settled Positions */}
      {settledPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {t.settled_positions}
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {settledPositions.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-3 text-left">{t.col_market}</th>
                    <th className="hidden pb-3 pr-3 text-left sm:table-cell">{t.col_outcome}</th>
                    <th className="pb-3 pr-3 text-left">{t.col_status}</th>
                    <th className="pb-3 text-right">{t.col_pnl}</th>
                  </tr>
                </thead>
                <tbody>
                  {settledPositions.map((pos) => {
                    const pnl = parseFloat(pos.pnlAmount);
                    return (
                      <tr key={pos.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pr-3 font-medium text-slate-800">
                          {locale === "zh" && pos.marketTitleZh ? pos.marketTitleZh : pos.marketTitle}
                        </td>
                        <td className="hidden py-3 pr-3 text-slate-500 sm:table-cell">
                          {parseFloat(pos.yesUnits) > 0 && `${formatDecimal(pos.yesUnits, 4)} ${sideLabel("yes", locale)}`}
                          {parseFloat(pos.yesUnits) > 0 && parseFloat(pos.noUnits) > 0 && " / "}
                          {parseFloat(pos.noUnits) > 0 && `${formatDecimal(pos.noUnits, 4)} ${sideLabel("no", locale)}`}
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${pos.status === "settled" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                            {statusLabel(pos.status, locale)}
                          </span>
                        </td>
                        <td className={`py-3 text-right font-mono font-semibold tabular-nums ${pnl > 0 ? "text-green-600" : pnl < 0 ? "text-red-600" : "text-slate-500"}`}>
                          {pnl >= 0 ? "+" : ""}${formatDecimal(pos.pnlAmount, 2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Trades */}
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
