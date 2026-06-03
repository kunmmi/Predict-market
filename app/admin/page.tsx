import { requireAdmin } from "@/lib/auth/require-admin";
import Link from "next/link";
import {
  Users, TrendingUp, GitBranch, ArrowDownLeft, CheckCircle2,
  BarChart2, DollarSign, Activity, Wallet, UserCheck, Clock,
  ArrowUpRight,
} from "lucide-react";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getAdminDashboardData } from "@/lib/services/admin-data";

export default async function AdminHomePage() {
  const { profile } = await requireAdmin();
  const data = await getAdminDashboardData();

  const statCards = [
    {
      label: "Users",
      value: data.summary.totalProfiles.toLocaleString(),
      icon: Users,
      href: "/admin/users",
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      border: "border-blue-400/20",
    },
    {
      label: "Promoters",
      value: data.summary.totalPromoters.toLocaleString(),
      icon: UserCheck,
      href: "/admin/promoters",
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      border: "border-violet-400/20",
    },
    {
      label: "Referrals",
      value: data.summary.totalReferrals.toLocaleString(),
      icon: GitBranch,
      href: "/admin/referrals",
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/20",
    },
    {
      label: "Total Deposits",
      value: data.summary.totalDeposits.toLocaleString(),
      icon: ArrowDownLeft,
      href: "/admin/deposits",
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
    {
      label: "Approved Deposits",
      value: data.summary.totalApprovedDeposits.toLocaleString(),
      icon: CheckCircle2,
      href: "/admin/deposits",
      color: "text-teal-400",
      bg: "bg-teal-400/10",
      border: "border-teal-400/20",
    },
    {
      label: "Active Markets",
      value: data.summary.totalActiveMarkets.toLocaleString(),
      icon: TrendingUp,
      href: "/admin/markets",
      color: "text-green-400",
      bg: "bg-green-400/10",
      border: "border-green-400/20",
    },
    {
      label: "Total Trades",
      value: data.summary.totalTrades.toLocaleString(),
      icon: BarChart2,
      href: "/admin/trades",
      color: "text-orange-400",
      bg: "bg-orange-400/10",
      border: "border-orange-400/20",
    },
    {
      label: "Trade Volume",
      value: `$${formatDecimal(data.summary.totalTradeVolume, 2)}`,
      icon: Activity,
      href: "/admin/trades",
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
      mono: true,
    },
    {
      label: "Platform Fees",
      value: `$${formatDecimal(data.summary.totalPlatformFees, 2)}`,
      icon: DollarSign,
      href: "/admin/trades",
      color: "text-teal-400",
      bg: "bg-teal-400/10",
      border: "border-teal-400/20",
      mono: true,
    },
    {
      label: "Promoter Commissions",
      value: `$${formatDecimal(data.summary.totalPromoterCommissions, 2)}`,
      icon: UserCheck,
      href: "/admin/commissions",
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      border: "border-violet-400/20",
      mono: true,
    },
    {
      label: "Platform Wallet",
      value: `$${formatDecimal(data.summary.platformWalletBalance, 2)}`,
      icon: Wallet,
      href: "/admin/platform-wallet",
      color: "text-green-400",
      bg: "bg-green-400/10",
      border: "border-green-400/20",
      mono: true,
      highlight: true,
    },
  ];

  const actionLinks = [
    { href: "/admin/platform-wallet", label: "Platform Wallet", icon: Wallet },
    { href: "/admin/deposits", label: "Review Deposits", icon: ArrowDownLeft },
    { href: "/admin/withdrawals", label: "Process Withdrawals", icon: ArrowUpRight },
    { href: "/admin/markets/new", label: "New Market", icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as <span className="font-mono text-slate-400">{profile.email}</span>
          </p>
          {data.warning && (
            <p className="mt-2 text-xs text-amber-400 flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              Metrics limited: {data.warning}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {actionLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-400"
            >
              <Icon className="h-3 w-3" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, href, color, bg, border, mono, highlight }) => (
          <Link
            key={label}
            href={href}
            className={`group relative overflow-hidden rounded-xl border bg-[#111318] p-4 transition-all hover:border-white/[0.12] hover:bg-[#161920] ${
              highlight ? "border-teal-400/30" : border
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className={`mt-3 ${mono ? "font-mono text-xl" : "text-2xl font-bold"} font-semibold tracking-tight text-white`}>
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
            {highlight && (
              <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-teal-400/5" />
            )}
          </Link>
        ))}
      </div>

      {/* Recent admin logs */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111318]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700/50">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Recent Admin Activity</h2>
          </div>
          <Link
            href="/admin/logs"
            className="text-xs text-slate-500 transition-colors hover:text-amber-400"
          >
            View all →
          </Link>
        </div>

        {data.recentAdminLogs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-600">No admin activity logged yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {data.recentAdminLogs.map((log) => (
              <li key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400/60" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-slate-200">{log.actionType}</span>
                    <span className="text-xs text-slate-500">on</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                      {log.targetTable}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-600">
                    {log.targetId}
                  </p>
                  {log.notes && (
                    <p className="mt-1 text-xs text-slate-500">{log.notes}</p>
                  )}
                </div>
                <time className="flex-shrink-0 text-xs text-slate-600">
                  {new Date(log.createdAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
