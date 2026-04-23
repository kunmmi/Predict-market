import Link from "next/link";
import { DollarSign, CheckCircle2, Lock, ArrowDownLeft, ArrowUpRight, TrendingUp, ChevronRight } from "lucide-react";

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
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
            <Icon className="h-4.5 w-4.5" />
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
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <TrendingUp className="mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-600">{t.no_positions}</p>
        <p className="mt-1 text-xs text-slate-400">{t.no_positions_sub}</p>
        <Link
          href="/markets"
          className={cn(buttonVariants({ size: "sm" }), "mt-4 gap-1")}
        >
          {t.browse_markets} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
            <th className="pb-2.5 pr-3">{t.col_market}</th>
            <th className="pb-2.5 pr-3 text-right">{t.col_yes_units}</th>
            <th className="pb-2.5 text-right">{t.col_no_units}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 last:border-0">
              <td className="py-2.5 pr-3 font-medium text-slate-900">
                {locale === "zh" && p.marketTitleZh ? p.marketTitleZh : p.marketTitle}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-green-700">{formatDecimal(p.yesUnits)}</td>
              <td className="py-2.5 text-right tabular-nums text-red-600">{formatDecimal(p.noUnits)}</td>
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
    return <p className="py-4 text-sm text-slate-400">{t.no_trades}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
            <th className="hidden pb-2.5 pr-3 sm:table-cell">{t.col_when}</th>
            <th className="pb-2.5 pr-3">{t.col_market}</th>
            <th className="pb-2.5 pr-3">{t.col_side}</th>
            <th className="pb-2.5 pr-3 text-right">{t.col_amount}</th>
            <th className="hidden pb-2.5 text-right sm:table-cell">{t.col_price}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((trade) => (
            <tr key={trade.id} className="border-b border-slate-50 last:border-0">
              <td className="hidden py-2.5 pr-3 text-xs text-slate-400 sm:table-cell">{formatWhen(trade.createdAt, locale)}</td>
              <td className="py-2.5 pr-3 font-medium text-slate-800">
                {locale === "zh" && trade.marketTitleZh ? trade.marketTitleZh : trade.marketTitle}
              </td>
              <td className="py-2.5 pr-3">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${
                    trade.side === "yes"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {sideLabel(trade.side, locale)}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">${formatDecimal(trade.amount)}</td>
              <td className="hidden py-2.5 text-right tabular-nums text-slate-500 sm:table-cell">{formatDecimal(trade.price, 4)}</td>
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
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ArrowDownLeft className="mb-3 h-7 w-7 text-slate-300" />
        <p className="text-sm font-medium text-slate-600">{t.no_deposits}</p>
        <Link
          href="/wallet/deposit"
          className={cn(buttonVariants({ size: "sm" }), "mt-3 gap-1")}
        >
          {t.make_deposit} <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
            <th className="hidden pb-2.5 pr-3 sm:table-cell">{t.col_when}</th>
            <th className="pb-2.5 pr-3">{t.col_asset}</th>
            <th className="pb-2.5 pr-3">{t.col_status}</th>
            <th className="pb-2.5 text-right">{t.col_amount}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-slate-50 last:border-0">
              <td className="hidden py-2.5 pr-3 text-xs text-slate-400 sm:table-cell">{formatWhen(d.createdAt, locale)}</td>
              <td className="py-2.5 pr-3 font-medium text-slate-800">{d.assetSymbol}</td>
              <td className="py-2.5 pr-3">
                <Badge variant={depositStatusVariant(d.status)}>{statusLabel(d.status, locale)}</Badge>
              </td>
              <td className="py-2.5 text-right tabular-nums text-slate-700">
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
  showAdminLink: boolean;
  locale: Locale;
  t: T["dashboard"];
}) {
  const displayName = fullName ?? email.split("@")[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{t.welcome} {displayName}</h1>
          <p className="page-subtitle">{email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/wallet/deposit" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
            <ArrowDownLeft className="h-4 w-4" />
            {t.deposit}
          </Link>
          <Link href="/wallet/withdraw" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
            <ArrowUpRight className="h-4 w-4" />
            {t.withdraw}
          </Link>
        </div>
      </div>

      {/* Balance stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t.total_balance}
          value={walletBalance != null ? `$${walletBalance}` : "—"}
          sub={t.usd_equivalent}
          icon={DollarSign}
          accent="bg-slate-100 text-slate-600"
        />
        <StatCard
          label={t.available}
          value={walletAvailable != null ? `$${walletAvailable}` : "—"}
          sub={t.ready_to_trade}
          icon={CheckCircle2}
          accent="bg-green-100 text-green-600"
        />
        <StatCard
          label={t.open_positions}
          value={String(data.openPositions.length)}
          sub={data.openPositions.length === 1 ? t.active_market : t.active_markets}
          icon={TrendingUp}
          accent="bg-yellow-100 text-yellow-700"
        />
      </div>

      {/* Quick actions row */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/markets"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <TrendingUp className="h-4 w-4" />
          {t.browse_markets}
        </Link>
        <Link
          href="/wallet"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <DollarSign className="h-4 w-4" />
          {t.view_wallet}
        </Link>
        <Link
          href="/portfolio"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <Lock className="h-4 w-4" />
          {t.view_portfolio}
        </Link>
      </div>

      {/* Open positions + Recent Trades side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">{t.open_positions_title}</CardTitle>
              <Link href="/portfolio" className="text-xs text-slate-500 hover:text-slate-900">
                {t.view_all}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <OpenPositionsSection rows={data.openPositions} t={t} locale={locale} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">{t.recent_trades}</CardTitle>
              <Link href="/portfolio" className="text-xs text-slate-500 hover:text-slate-900">
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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">{t.recent_deposits}</CardTitle>
            <Link href="/wallet" className="text-xs text-slate-500 hover:text-slate-900">
              {t.view_all}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <RecentDepositsSection rows={data.recentDeposits} t={t} locale={locale} />
        </CardContent>
      </Card>

      {/* Promoter card */}
      {data.promoter ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t.promoter_program}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-xs text-slate-400">{t.promo_code}</p>
                <code className="mt-0.5 block rounded bg-slate-100 px-2 py-1 text-xs font-mono font-semibold text-slate-800">
                  {data.promoter.promoCode}
                </code>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t.commission_rate}</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  {(parseFloat(data.promoter.commissionRate) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t.total_earned}</p>
                <p className="mt-0.5 font-semibold text-slate-800">
                  ${formatDecimal(data.promoter.totalCommissionGenerated)}
                </p>
              </div>
            </div>
            <Link href="/promoter" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 underline underline-offset-4 hover:text-yellow-600">
              {t.open_promoter} <ChevronRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between py-5">
            <div>
              <p className="text-sm font-semibold text-slate-800">{t.become_promoter}</p>
              <p className="mt-0.5 text-xs text-slate-500">{t.become_promoter_sub}</p>
            </div>
            <Link
              href="/promoter/register"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
            >
              {t.apply_now} <ChevronRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      )}

      {showAdminLink && (
        <p className="text-sm">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 font-semibold text-slate-900 underline underline-offset-4 hover:text-yellow-600"
          >
            {t.open_admin} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </p>
      )}
    </div>
  );
}
