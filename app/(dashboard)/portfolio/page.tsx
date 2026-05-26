export const dynamic = "force-dynamic";

import { DollarSign, BarChart2, TrendingUp, Trophy } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { getPortfolioData } from "@/lib/services/portfolio-data";
import { getWalletData } from "@/lib/services/wallet-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { Card, CardContent } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { OpenPositionsLive } from "./open-positions-live";
import { LimitOrdersPanel } from "./limit-orders-panel";
import { HistoryTabs } from "./history-tabs";

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

      <HistoryTabs
        settledPositions={settledPositions}
        recentTrades={recentTrades}
        locale={locale}
        dateLocale={dateLocale}
      />
    </div>
  );
}
