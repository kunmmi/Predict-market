"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  BarChart3, LayoutDashboard, TrendingUp, Briefcase,
  Wallet, Users, User, Menu, X, Trophy, MessageCircle,
} from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { Locale, T } from "@/lib/i18n/translations";

type Props = { locale: Locale; t: T["nav"] };

export function DashboardNav({ locale, t }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const NAV_ITEMS = [
    { href: "/dashboard",   label: t.dashboard,   en: "Dashboard",   icon: LayoutDashboard },
    { href: "/markets",     label: t.markets,     en: "Markets",     icon: TrendingUp },
    { href: "/portfolio",   label: t.portfolio,   en: "Portfolio",   icon: Briefcase },
    // { href: "/leaderboard", label: t.leaderboard, en: "Leaderboard", icon: Trophy }, // hidden until platform has more users
    { href: "/wallet",      label: t.wallet,      en: "Wallet",      icon: Wallet },
    { href: "/promoter",    label: t.promoter,    en: "Promoter",    icon: Users },
    { href: "/profile",     label: t.profile,     en: "Profile",     icon: User },
    { href: "/support",     label: "Support",     en: "Support",     icon: MessageCircle },
  ];

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid var(--border-dim)",
          backgroundColor: "var(--bg-nav-glass)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-stretch justify-between px-4 sm:px-6" style={{ height: 56 }}>
          {/* Logo + desktop nav */}
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5"
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  width: 28, height: 28,
                  background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                  borderRadius: 7,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 12px var(--gold-glow)",
                  flexShrink: 0,
                }}
              >
                <BarChart3 style={{ width: 14, height: 14, color: "#070809" }} />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.0625rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-primary)",
                }}
              >
                Predict Market
              </span>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden items-stretch md:flex" style={{ height: "100%" }}>
              {NAV_ITEMS.map(({ href, label, en, icon: Icon }) => {
                const isActive =
                  href === "/dashboard"
                    ? pathname === href
                    : pathname === href || pathname.startsWith(href + "/");

                return (
                  <div key={href} className="group relative flex items-stretch">
                    <Link
                      href={href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "0 12px",
                        fontFamily: "var(--font-sans)",
                        fontSize: "0.8125rem",
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? "var(--gold)" : "var(--text-secondary)",
                        textDecoration: "none",
                        transition: "color 150ms ease",
                        borderBottom: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                        marginBottom: "-1px",
                      }}
                      className={isActive ? "" : "hover:!text-[--text-primary]"}
                    >
                      <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
                      {label}
                    </Link>

                    {locale === "zh" && (
                      <span
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "calc(100% + 8px)",
                          transform: "translateX(-50%)",
                          whiteSpace: "nowrap",
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: "11px",
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          pointerEvents: "none",
                          opacity: 0,
                          transition: "opacity 150ms ease",
                          zIndex: 99,
                        }}
                        className="group-hover:!opacity-100"
                      >
                        {en}
                      </span>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <NotificationBell locale={locale} />
            <ThemeToggle />
            <LanguageSwitcher locale={locale} />
            <div className="hidden md:block">
              <LogoutButton label={t.logout} />
            </div>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36, height: 36,
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
                backgroundColor: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
              }}
              className="md:hidden hover:!border-[--border-strong] hover:!text-[--text-primary]"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X style={{ width: 16, height: 16 }} /> : <Menu style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 40,
            backgroundColor: "var(--bg-scrim)",
            backdropFilter: "blur(4px)",
          }}
          className="md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        style={{
          position: "fixed",
          insetBlock: 0, right: 0,
          zIndex: 50,
          width: 280,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "-32px 0 64px var(--shadow-drawer)",
          transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className="md:hidden"
      >
        {/* Drawer header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 56,
            borderBottom: "1px solid var(--border-dim)",
            padding: "0 16px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.9375rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-primary)",
            }}
          >
            Menu
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32,
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
          {NAV_ITEMS.map(({ href, label, en, icon: Icon }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  marginBottom: 2,
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? "var(--gold)" : "var(--text-secondary)",
                  backgroundColor: isActive ? "var(--gold-dim)" : "transparent",
                  textDecoration: "none",
                  transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
                  border: isActive ? "1px solid var(--border-gold)" : "1px solid transparent",
                }}
              >
                <Icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {locale === "zh" && (
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>{en}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Drawer footer */}
        <div
          style={{
            borderTop: "1px solid var(--border-dim)",
            padding: "16px",
          }}
        >
          <LogoutButton label={t.logout} />
        </div>
      </div>
    </>
  );
}
