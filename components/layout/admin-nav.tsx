"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, LayoutDashboard, TrendingUp, ArrowDownLeft, ArrowUpRight,
  Users, UserCheck, BarChart2, GitBranch, ScrollText, DollarSign
} from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import type { Locale, T } from "@/lib/i18n/translations";

type Props = { locale: Locale; t: T["nav"] };

export function AdminNav({ locale, t }: Props) {
  const pathname = usePathname();

  const NAV_ITEMS = [
    { href: "/admin",             label: t.overview,    en: "Overview",    icon: LayoutDashboard, exact: true },
    { href: "/admin/markets",     label: t.markets,     en: "Markets",     icon: TrendingUp },
    { href: "/admin/deposits",    label: t.deposits,    en: "Deposits",    icon: ArrowDownLeft },
    { href: "/admin/withdrawals", label: t.withdrawals, en: "Withdrawals", icon: ArrowUpRight },
    { href: "/admin/trades",      label: t.trades,      en: "Trades",      icon: BarChart2 },
    { href: "/admin/users",       label: t.users,       en: "Users",       icon: Users },
    { href: "/admin/promoters",   label: t.promoters,   en: "Promoters",   icon: UserCheck },
    { href: "/admin/commissions", label: t.commissions, en: "Commissions", icon: DollarSign },
    { href: "/admin/referrals",   label: t.referrals,   en: "Referrals",   icon: GitBranch },
    { href: "/admin/logs",        label: t.logs,        en: "Logs",        icon: ScrollText },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2 py-4">
            <div className="rounded bg-yellow-400 p-1.5 text-slate-900">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight text-white">Elemental</span>
            <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300 ring-1 ring-slate-700">
              Admin
            </span>
          </Link>
          <nav className="flex items-center gap-0.5 overflow-x-auto">
            {NAV_ITEMS.map(({ href, label, en, icon: Icon, exact }) => {
              const isActive = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");
              return (
                <div key={href} className="group relative">
                  <Link
                    href={href}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? "text-yellow-400"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </Link>
                  {locale === "zh" && (
                    <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-900 opacity-0 shadow-lg ring-1 ring-slate-200 transition-opacity group-hover:opacity-100">
                      {en}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3 py-2">
          <Link href="/dashboard" className="text-xs text-slate-400 transition-colors hover:text-white">
            {t.user_view}
          </Link>
          <LanguageSwitcher locale={locale} />
          <LogoutButton label={t.logout} />
        </div>
      </div>
    </header>
  );
}
