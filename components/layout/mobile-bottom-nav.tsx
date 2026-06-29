"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Briefcase, Wallet, Trophy, LayoutDashboard, Dice6 } from "lucide-react";

import type { Locale, T } from "@/lib/i18n/translations";

type Props = { locale: Locale; t: T["nav"] };

/**
 * Mobile-only bottom navigation bar using APEX dark theme CSS vars.
 * Pins 5 most-used destinations to the bottom of the viewport with
 * safe-area padding for notch/home-indicator devices.
 * Hidden on md+ screens; desktop users have the top nav.
 */
export function MobileBottomNav({ locale, t }: Props) {
  const pathname = usePathname();

  const items = [
    { href: "/dashboard",   label: t.dashboard,   icon: LayoutDashboard },
    { href: "/markets",     label: t.markets,     icon: TrendingUp },
    { href: "/portfolio",   label: t.portfolio,   icon: Briefcase },
    { href: "/wallet",      label: t.wallet,      icon: Wallet },
    { href: "/games/craps", label: t.games,       icon: Dice6 },
    // { href: "/leaderboard", label: t.leaderboard, icon: Trophy }, // hidden until platform has more users
  ];

  return (
    <nav
      className="md:hidden"
      aria-label="Primary mobile navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        backgroundColor: "rgba(7,8,9,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid var(--border-subtle)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
        paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
      }}
    >
      <ul style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  paddingTop: 10,
                  paddingBottom: 10,
                  fontSize: 10,
                  fontFamily: "var(--font-sans)",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--gold)" : "var(--text-dim)",
                  textDecoration: "none",
                  transition: "color 150ms ease",
                }}
              >
                <Icon
                  style={{
                    width: 20,
                    height: 20,
                    color: isActive ? "var(--gold)" : "var(--text-dim)",
                    transition: "color 150ms ease",
                    strokeWidth: isActive ? 2.4 : 2,
                  }}
                />
                <span style={{ lineHeight: 1, letterSpacing: locale === "zh" ? "0.01em" : "0.02em" }}>
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
