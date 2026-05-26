"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Briefcase, Wallet, Trophy, LayoutDashboard } from "lucide-react";

import type { Locale, T } from "@/lib/i18n/translations";

type Props = { locale: Locale; t: T["nav"] };

/**
 * Mobile-only bottom navigation. Pins 5 most-used destinations to the bottom
 * of the viewport for one-tap switching — standard trading-app UX
 * (Robinhood / Binance / Polymarket pattern).
 *
 * Hidden on md+ screens; desktop users have the top nav.
 *
 * NOTE: This is rendered AFTER the dashboard <main> content. The dashboard
 * layout adds `pb-16 md:pb-0` to leave room for it on mobile.
 */
export function MobileBottomNav({ locale, t }: Props) {
  const pathname = usePathname();

  const items = [
    { href: "/dashboard",   label: t.dashboard,   icon: LayoutDashboard },
    { href: "/markets",     label: t.markets,     icon: TrendingUp },
    { href: "/portfolio",   label: t.portfolio,   icon: Briefcase },
    { href: "/leaderboard", label: t.leaderboard, icon: Trophy },
    { href: "/wallet",      label: t.wallet,      icon: Wallet },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white shadow-[0_-2px_12px_rgba(15,23,42,0.06)] pb-[max(env(safe-area-inset-bottom),0px)] md:hidden"
      aria-label="Primary mobile navigation"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");

          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive
                    ? "text-yellow-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={`h-5 w-5 ${isActive ? "text-yellow-500" : "text-slate-400"}`}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span className={`leading-tight ${locale === "zh" ? "text-[11px]" : ""}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
