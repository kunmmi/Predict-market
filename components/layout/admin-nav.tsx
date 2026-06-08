"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, LayoutDashboard, TrendingUp, ArrowDownLeft, ArrowUpRight,
  Users, UserCheck, BarChart2, GitBranch, ScrollText, DollarSign, Wallet, Menu, X, Settings
} from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import type { Locale, T } from "@/lib/i18n/translations";

type Props = { locale: Locale; t: T["nav"] };

export function AdminNav({ locale, t }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const NAV_ITEMS = [
    { href: "/admin",                label: t.overview,        en: "Overview",         icon: LayoutDashboard, exact: true },
    { href: "/admin/markets",        label: t.markets,         en: "Markets",          icon: TrendingUp },
    { href: "/admin/deposits",       label: t.deposits,        en: "Deposits",         icon: ArrowDownLeft },
    { href: "/admin/withdrawals",    label: t.withdrawals,     en: "Withdrawals",      icon: ArrowUpRight },
    { href: "/admin/trades",         label: t.trades,          en: "Trades",           icon: BarChart2 },
    { href: "/admin/users",          label: t.users,           en: "Users",            icon: Users },
    { href: "/admin/promoters",      label: t.promoters,       en: "Promoters",        icon: UserCheck },
    { href: "/admin/commissions",    label: t.commissions,     en: "Commissions",      icon: DollarSign },
    { href: "/admin/platform-wallet",label: t.platform_wallet, en: "Platform Wallet",  icon: Wallet },
    { href: "/admin/referrals",      label: t.referrals,       en: "Referrals",        icon: GitBranch },
    { href: "/admin/logs",           label: t.logs,            en: "Logs",             icon: ScrollText },
    { href: "/admin/settings",      label: "Settings",        en: "Settings",         icon: Settings },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const currentItem = NAV_ITEMS.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0d0f12] overflow-x-hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo + desktop nav — min-w-0 so flex item can shrink, overflow scrolls internally */}
          <div className="flex min-w-0 flex-1 items-center gap-4 py-3">
            <Link href="/admin" className="flex shrink-0 items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]">
                <BarChart3 className="h-4 w-4 text-slate-900" />
              </div>
              <span className="font-bold tracking-tight text-white text-sm">Predict Market</span>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                Admin
              </span>
            </Link>

            {/* Desktop nav — scrolls internally if all items don't fit */}
            <nav className="hidden lg:flex min-w-0 items-center gap-0.5 overflow-x-auto">
              {NAV_ITEMS.map(({ href, label, en, icon: Icon, exact }) => {
                const active = isActive(href, exact);
                return (
                  <div key={href} className="group relative">
                    <Link
                      href={href}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-xs font-medium transition-all duration-150 ${
                        active
                          ? "bg-amber-400/10 text-amber-400"
                          : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <Icon className={`h-3 w-3 ${active ? "text-amber-400" : ""}`} />
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

          {/* Right side */}
          <div className="flex shrink-0 items-center gap-2 py-3">
            <Link
              href="/dashboard"
              className="hidden sm:block text-xs text-slate-500 transition-colors hover:text-white"
            >
              {t.user_view}
            </Link>
            <div className="hidden sm:block">
              <LanguageSwitcher locale={locale} />
            </div>
            <div className="hidden sm:block">
              <LogoutButton label={t.logout} />
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile current page indicator */}
        {currentItem && !mobileOpen && (
          <div className="lg:hidden border-t border-white/[0.04] px-4 py-2 flex items-center gap-2">
            <currentItem.icon className="h-3 w-3 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">{currentItem.en}</span>
          </div>
        )}
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-50 w-72 flex flex-col bg-[#0d0f12] border-r border-white/[0.06] shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)]">
              <BarChart3 className="h-4 w-4 text-slate-900" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Predict Market</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">Admin Panel</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, en, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-amber-400/10 text-amber-400 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.15)]"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-amber-400" : "text-slate-500"}`} />
                <span>{locale === "zh" ? label : en}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Drawer footer */}
        <div className="border-t border-white/[0.06] px-4 py-4 space-y-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            <span>→</span>
            <span>{t.user_view}</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher locale={locale} />
            <LogoutButton label={t.logout} />
          </div>
        </div>
      </div>
    </>
  );
}
