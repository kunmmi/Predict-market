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
    const yesVal = parseFloat(pos.yesUnits) * (pos.latestYesPrice != null ? parseFloat(pos.latestYesPrice) : 0);
    const noVal  = parseFloat(pos.noUnits)  * (pos.latestNoPrice  != null ? parseFloat(pos.latestNoPrice)  : 0);
    return sum + yesVal + noVal;
  }, 0);

  const totalPnl = settledPositions.reduce((sum, pos) => sum + parseFloat(pos.pnlAmount), 0);
  const wins   = settledPositions.filter((p) => parseFloat(p.pnlAmount) > 0).length;
  const losses = settledPositions.filter((p) => parseFloat(p.pnlAmount) < 0).length;
  const pnlPositive = totalPnl >= 0;

  const stats = [
    {
      label: t.available_balance,
      value: `$${formatDecimal(walletData.wallet?.availableBalance, 2)}`,
      icon: DollarSign,
      accent: "var(--gold)",
      border: "var(--border-gold)",
    },
    {
      label: t.open_positions,
      value: String(openPositions.length),
      icon: BarChart2,
      accent: "var(--gold)",
      border: "var(--border-gold)",
    },
    {
      label: t.est_value,
      value: `$${formatDecimal(estValue, 2)}`,
      icon: TrendingUp,
      accent: "var(--teal)",
      border: "rgba(13,184,145,0.25)",
    },
    {
      label: locale === "zh" ? "历史盈亏" : "Total P&L",
      value: `${pnlPositive ? "+" : ""}$${formatDecimal(Math.abs(totalPnl), 2)}`,
      valueColor: pnlPositive ? "var(--teal)" : "var(--rose)",
      sub: settledPositions.length > 0 ? `${wins}W – ${losses}L` : undefined,
      icon: Trophy,
      accent: pnlPositive ? "var(--teal)" : "var(--rose)",
      border: pnlPositive ? "rgba(13,184,145,0.25)" : "rgba(232,68,90,0.25)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">{t.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, valueColor, sub, icon: Icon, accent, border }) => (
          <Card key={label}>
            <CardContent style={{ paddingTop: 20, paddingBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <p style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                    fontWeight: 700, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "var(--text-dim)",
                  }}>
                    {label}
                  </p>
                  <p style={{
                    marginTop: 8,
                    fontFamily: "var(--font-mono)", fontSize: "1.625rem",
                    fontWeight: 700, letterSpacing: "-0.02em",
                    color: valueColor ?? "var(--text-primary)",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}>
                    {value}
                  </p>
                  {sub && (
                    <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "var(--text-dim)" }}>
                      {sub}
                    </p>
                  )}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--bg-elevated)",
                  border: `1px solid ${border}`,
                  flexShrink: 0,
                }}>
                  <Icon style={{ width: 16, height: 16, color: accent }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <OpenPositionsLive initialPositions={openPositions} locale={locale} t={t} />
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
