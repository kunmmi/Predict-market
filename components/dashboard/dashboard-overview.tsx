import Link from "next/link";
import {
  DollarSign, CheckCircle2, Lock, ArrowDownLeft,
  ArrowUpRight, TrendingUp, ChevronRight,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/helpers/cn";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import type { Locale, T } from "@/lib/i18n/translations";
import { sideLabel, statusLabel } from "@/lib/i18n/labels";
import type {
  DashboardData,
  DashboardDeposit,
  DashboardOpenPosition,
  DashboardTrade,
} from "@/lib/services/dashboard-data";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";
import { LiveRoundsWidget } from "@/components/dashboard/live-rounds-widget";
import { MiniLeaderboardWidget } from "@/components/dashboard/mini-leaderboard-widget";
import { WorldCupBanner } from "@/components/dashboard/world-cup-banner";

function depositStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "approved") return "default";
  if (status === "rejected" || status === "cancelled") return "destructive";
  return "secondary";
}

function formatWhen(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accentColor,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accentColor: string;
}) {
  return (
    <Card>
      <CardContent style={{ paddingTop: 20, paddingBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                fontWeight: 600, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "var(--text-dim)",
              }}
            >
              {label}
            </p>
            <p
              style={{
                marginTop: 6,
                fontFamily: "var(--font-mono)", fontSize: "1.5rem",
                fontWeight: 700, letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </p>
            <p
              style={{
                marginTop: 2,
                fontFamily: "var(--font-sans)", fontSize: "0.6875rem",
                color: "var(--text-dim)",
              }}
            >
              {sub}
            </p>
          </div>
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-elevated)",
              border: `1px solid ${accentColor}`,
              flexShrink: 0,
            }}
          >
            <Icon style={{ width: 16, height: 16, color: accentColor }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OpenPositionsSection({
  rows,
  t,
  locale,
}: {
  rows: DashboardOpenPosition[];
  t: T["dashboard"];
  locale: Locale;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "2.5rem 1rem", textAlign: "center",
        }}
      >
        <TrendingUp style={{ width: 32, height: 32, color: "var(--text-dim)", marginBottom: 12 }} />
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
          {t.no_positions}
        </p>
        <p style={{ marginTop: 4, fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--text-dim)" }}>
          {t.no_positions_sub}
        </p>
        <Link
          href="/markets"
          className={cn(buttonVariants({ size: "sm" }), "mt-4 gap-1")}
        >
          {t.browse_markets} <ChevronRight style={{ width: 12, height: 12 }} />
        </Link>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>{t.col_market}</th>
            <th style={{ textAlign: "right" }}>{t.col_yes_units}</th>
            <th style={{ textAlign: "right" }}>{t.col_no_units}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 500 }}>
                {locale === "zh" && p.marketTitleZh ? p.marketTitleZh : p.marketTitle}
              </td>
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--teal)", fontFamily: "var(--font-mono)" }}>
                {formatDecimal(p.yesUnits)}
              </td>
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--rose)", fontFamily: "var(--font-mono)" }}>
                {formatDecimal(p.noUnits)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentTradesSection({
  rows,
  t,
  locale,
}: {
  rows: DashboardTrade[];
  t: T["dashboard"];
  locale: Locale;
}) {
  if (rows.length === 0) {
    return (
      <p style={{ padding: "1rem 0", fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--text-dim)" }}>
        {t.no_trades}
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th className="hidden sm:table-cell">{t.col_when}</th>
            <th>{t.col_market}</th>
            <th>{t.col_side}</th>
            <th style={{ textAlign: "right" }}>{t.col_amount}</th>
            <th className="hidden sm:table-cell" style={{ textAlign: "right" }}>{t.col_price}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((trade) => (
            <tr key={trade.id}>
              <td className="hidden sm:table-cell" style={{ color: "var(--text-dim)" }}>
                {formatWhen(trade.createdAt, locale)}
              </td>
              <td style={{ fontWeight: 500 }}>
                {locale === "zh" && trade.marketTitleZh ? trade.marketTitleZh : trade.marketTitle}
              </td>
              <td>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "2px 8px", borderRadius: 100,
                    fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                    fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    backgroundColor: trade.side === "yes" ? "var(--teal-dim)" : "var(--rose-dim)",
                    border: `1px solid ${trade.side === "yes" ? "rgba(13,184,145,0.25)" : "rgba(232,68,90,0.25)"}`,
                    color: trade.side === "yes" ? "var(--teal)" : "var(--rose)",
                  }}
                >
                  {sideLabel(trade.side, locale)}
                </span>
              </td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                ${formatDecimal(trade.amount)}
              </td>
              <td className="hidden sm:table-cell" style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                {formatDecimal(trade.price, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentDepositsSection({
  rows,
  t,
  locale,
}: {
  rows: DashboardDeposit[];
  t: T["dashboard"];
  locale: Locale;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "2rem 1rem", textAlign: "center",
        }}
      >
        <ArrowDownLeft style={{ width: 28, height: 28, color: "var(--text-dim)", marginBottom: 10 }} />
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
          {t.no_deposits}
        </p>
        <Link
          href="/wallet/deposit"
          className={cn(buttonVariants({ size: "sm" }), "mt-3 gap-1")}
        >
          {t.make_deposit} <ChevronRight style={{ width: 12, height: 12 }} />
        </Link>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th className="hidden sm:table-cell">{t.col_when}</th>
            <th>{t.col_asset}</th>
            <th>{t.col_status}</th>
            <th style={{ textAlign: "right" }}>{t.col_amount}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="hidden sm:table-cell" style={{ color: "var(--text-dim)" }}>
                {formatWhen(d.createdAt, locale)}
              </td>
              <td style={{ fontWeight: 500 }}>{d.assetSymbol}</td>
              <td>
                <Badge variant={depositStatusVariant(d.status)}>{statusLabel(d.status, locale)}</Badge>
              </td>
              <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                {d.amountReceived != null
                  ? `$${formatDecimal(d.amountReceived)}`
                  : d.amountExpected != null
                    ? `$${formatDecimal(d.amountExpected)}`
                    : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardOverview({
  email,
  fullName,
  role,
  profileStatus,
  walletBalance,
  walletAvailable,
  walletStatus,
  data,
  topPlayers,
  showAdminLink,
  locale,
  t,
}: {
  email: string;
  fullName: string | null;
  role: string;
  profileStatus: string;
  walletBalance: string | null;
  walletAvailable: string | null;
  walletStatus: string | null;
  data: DashboardData;
  topPlayers: LeaderboardEntry[];
  showAdminLink: boolean;
  locale: Locale;
  t: T["dashboard"];
}) {
  const displayName = fullName ?? email.split("@")[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h1 className="page-title">{t.welcome} {displayName}</h1>
          <p className="page-subtitle">{email}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/wallet/deposit" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
            <ArrowDownLeft style={{ width: 14, height: 14 }} />
            {t.deposit}
          </Link>
          <Link href="/wallet/withdraw" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
            <ArrowUpRight style={{ width: 14, height: 14 }} />
            {t.withdraw}
          </Link>
        </div>
      </div>

      {/* World Cup featured event banner */}
      <WorldCupBanner locale={locale} />

      {/* Live rounds */}
      {data.liveRounds.length > 0 && (
        <LiveRoundsWidget markets={data.liveRounds} locale={locale} />
      )}

      {/* Balance stats + mini leaderboard */}
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label={t.total_balance}
            value={walletBalance != null ? `$${walletBalance}` : "—"}
            sub={t.usd_equivalent}
            icon={DollarSign}
            accentColor="var(--gold)"
          />
          <StatCard
            label={t.available}
            value={walletAvailable != null ? `$${walletAvailable}` : "—"}
            sub={t.ready_to_trade}
            icon={CheckCircle2}
            accentColor="var(--teal)"
          />
          <StatCard
            label={t.open_positions}
            value={String(data.openPositions.length)}
            sub={data.openPositions.length === 1 ? t.active_market : t.active_markets}
            icon={TrendingUp}
            accentColor="var(--gold)"
          />
        </div>
        <MiniLeaderboardWidget entries={topPlayers} zh={locale === "zh"} />
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Link href="/markets" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          <TrendingUp style={{ width: 14, height: 14 }} />
          {t.browse_markets}
        </Link>
        <Link href="/wallet" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          <DollarSign style={{ width: 14, height: 14 }} />
          {t.view_wallet}
        </Link>
        <Link href="/portfolio" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          <Lock style={{ width: 14, height: 14 }} />
          {t.view_portfolio}
        </Link>
      </div>

      {/* Open positions + Recent trades */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader style={{ paddingBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <CardTitle>{t.open_positions_title}</CardTitle>
              <Link
                href="/portfolio"
                style={{
                  fontFamily: "var(--font-sans)", fontSize: "0.6875rem",
                  fontWeight: 600, color: "var(--text-dim)", textDecoration: "none",
                }}
                className="hover:text-[var(--gold)]"
              >
                {t.view_all}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <OpenPositionsSection rows={data.openPositions} t={t} locale={locale} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader style={{ paddingBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <CardTitle>{t.recent_trades}</CardTitle>
              <Link
                href="/portfolio"
                style={{
                  fontFamily: "var(--font-sans)", fontSize: "0.6875rem",
                  fontWeight: 600, color: "var(--text-dim)", textDecoration: "none",
                }}
                className="hover:text-[var(--gold)]"
              >
                {t.view_all}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <RecentTradesSection rows={data.recentTrades} t={t} locale={locale} />
          </CardContent>
        </Card>
      </div>

      {/* Recent deposits */}
      <Card>
        <CardHeader style={{ paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <CardTitle>{t.recent_deposits}</CardTitle>
            <Link
              href="/wallet"
              style={{
                fontFamily: "var(--font-sans)", fontSize: "0.6875rem",
                fontWeight: 600, color: "var(--text-dim)", textDecoration: "none",
              }}
              className="hover:text-[var(--gold)]"
            >
              {t.view_all}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <RecentDepositsSection rows={data.recentDeposits} t={t} locale={locale} />
        </CardContent>
      </Card>

      {/* Promoter panel */}
      {data.promoter ? (
        <Card>
          <CardHeader style={{ paddingBottom: 12 }}>
            <CardTitle>{t.promoter_program}</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
                  {t.promo_code}
                </p>
                <code
                  style={{
                    display: "block", marginTop: 4,
                    fontFamily: "var(--font-mono)", fontSize: "0.8125rem",
                    fontWeight: 600, color: "var(--gold)",
                    backgroundColor: "var(--gold-dim)",
                    border: "1px solid var(--border-gold)",
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 10px",
                  }}
                >
                  {data.promoter.promoCode}
                </code>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
                  {t.commission_rate}
                </p>
                <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {(parseFloat(data.promoter.commissionRate) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
                  {t.total_earned}
                </p>
                <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "var(--teal)" }}>
                  ${formatDecimal(data.promoter.totalCommissionGenerated)}
                </p>
              </div>
            </div>
            <Link
              href="/promoter"
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontFamily: "var(--font-sans)", fontSize: "0.75rem",
                fontWeight: 600, color: "var(--gold)", textDecoration: "none",
              }}
              className="hover:opacity-80"
            >
              {t.open_promoter} <ChevronRight style={{ width: 12, height: 12 }} />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card style={{ border: "1px dashed var(--border-strong)" }}>
          <CardContent style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 20, paddingBottom: 20 }}>
            <div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {t.become_promoter}
              </p>
              <p style={{ marginTop: 2, fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                {t.become_promoter_sub}
              </p>
            </div>
            <Link
              href="/promoter/register"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
            >
              {t.apply_now} <ChevronRight style={{ width: 12, height: 12 }} />
            </Link>
          </CardContent>
        </Card>
      )}

      {showAdminLink && (
        <p>
          <Link
            href="/admin"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: "var(--font-sans)", fontSize: "0.875rem",
              fontWeight: 600, color: "var(--text-secondary)", textDecoration: "none",
            }}
            className="hover:text-[var(--gold)]"
          >
            {t.open_admin} <ChevronRight style={{ width: 13, height: 13 }} />
          </Link>
        </p>
      )}
    </div>
  );
}
