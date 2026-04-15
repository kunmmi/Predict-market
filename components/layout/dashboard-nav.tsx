"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { BarChart3, LayoutDashboard, TrendingUp, Briefcase, Wallet, Users, User, Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import type { Locale, T } from "@/lib/i18n/translations";

type Props = { locale: Locale; t: T["nav"] };

export function DashboardNav({ locale, t }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const NAV_ITEMS = [
    { href: "/dashboard", label: t.dashboard, en: "Dashboard", icon: LayoutDashboard },
    { href: "/markets",   label: t.markets,   en: "Markets",   icon: TrendingUp },
    { href: "/portfolio", label: t.portfolio,  en: "Portfolio", icon: Briefcase },
    { href: "/wallet",    label: t.wallet,     en: "Wallet",    icon: Wallet },
    { href: "/promoter",  label: t.promoter,   en: "Promoter",  icon: Users },
    { href: "/profile",   label: t.profile,    en: "Profile",   icon: User },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
          {/* Left: Logo + desktop nav */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="rounded bg-yellow-400 p-1.5 text-slate-900">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold tracking-tight text-white">Elemental</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map(({ href, label, en, icon: Icon }) => {
                const isActive =
                  href === "/dashboard"
                    ? pathname === href
                    : pathname === href || pathname.startsWith(href + "/");
                return (
                  <div key={href} className="group relative">
                    <Link
                      href={href}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "text-yellow-400"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
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

          {/* Right: language + logout + hamburger */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher locale={locale} />
            <div className="hidden md:block">
              <LogoutButton label={t.logout} />
            </div>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white md:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile menu drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-700 px-4">
          <span className="text-sm font-semibold text-white">Menu</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {NAV_ITEMS.map(({ href, label, en, icon: Icon }) => {
              const isActive =
                href === "/dashboard"
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-800 text-yellow-400"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                  {locale === "zh" && (
                    <span className="ml-auto text-xs text-slate-500">{en}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Drawer footer */}
        <div className="border-t border-slate-700 p-4">
          <LogoutButton label={t.logout} />
        </div>
      </div>
    </>
  );
}
