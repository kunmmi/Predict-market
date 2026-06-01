"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3, Menu, X } from "lucide-react";

import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Locale } from "@/lib/i18n/translations";

type Props = {
  locale: Locale;
  user: boolean;
  navLinks: { label: string; href: string }[];
  labels: {
    login: string;
    register: string;
    dashboard: string;
  };
};

export function HomeNav({ locale, user, navLinks, labels }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group" style={{ textDecoration: "none" }}>
              <div
                style={{
                  width: 32, height: 32,
                  background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                  borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 16px var(--gold-glow)",
                }}
              >
                <BarChart3 style={{ width: 16, height: 16, color: "#070809" }} />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
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
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.8125rem",
                    fontWeight: 400,
                    letterSpacing: "0.02em",
                    color: "var(--text-secondary)",
                    padding: "6px 12px",
                    borderRadius: 6,
                    transition: "color 150ms ease",
                    textDecoration: "none",
                  }}
                  className="hover:text-[--text-primary]"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop right side */}
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <LanguageSwitcher locale={locale} />
            {!user ? (
              <>
                <Link
                  href="/login"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    padding: "7px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border-subtle)",
                    textDecoration: "none",
                    transition: "color 150ms ease",
                  }}
                  className="hover:border-[--border-strong] hover:text-white"
                >
                  {labels.login}
                </Link>
                <Link
                  href="/signup"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#070809",
                    padding: "7px 18px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                    textDecoration: "none",
                    transition: "opacity 150ms ease",
                    boxShadow: "0 0 20px var(--gold-glow)",
                  }}
                  className="hover:opacity-90"
                >
                  {labels.register}
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#070809",
                  padding: "7px 18px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                  textDecoration: "none",
                  boxShadow: "0 0 20px var(--gold-glow)",
                }}
              >
                {labels.dashboard}
              </Link>
            )}
          </div>

          {/* Mobile right side */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <LanguageSwitcher locale={locale} />
            {/* Primary CTA visible on mobile */}
            {!user ? (
              <Link
                href="/signup"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#070809",
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                  textDecoration: "none",
                }}
              >
                {labels.register}
              </Link>
            ) : (
              <Link
                href="/dashboard"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#070809",
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                  textDecoration: "none",
                }}
              >
                {labels.dashboard}
              </Link>
            )}
            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
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
            >
              {mobileOpen ? <X style={{ width: 16, height: 16 }} /> : <Menu style={{ width: 16, height: 16 }} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            backgroundColor: "var(--bg-scrim)",
            backdropFilter: "blur(4px)",
          }}
        />
      )}

      {/* Mobile drawer */}
      <div
        className="md:hidden"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: 260,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "-32px 0 64px var(--shadow-drawer)",
          transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
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
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          {navLinks.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "11px 14px",
                borderRadius: 8,
                marginBottom: 2,
                fontFamily: "var(--font-sans)",
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "var(--text-secondary)",
                textDecoration: "none",
                transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
                border: "1px solid transparent",
              }}
              className="hover:bg-[var(--bg-elevated)] hover:text-[--text-primary] hover:border-[var(--border-subtle)]"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth footer */}
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          {!user ? (
            <>
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "11px",
                  borderRadius: 8,
                  border: "1px solid var(--border-strong)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                }}
              >
                {labels.login}
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "11px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#070809",
                  textDecoration: "none",
                  boxShadow: "0 0 20px var(--gold-glow)",
                }}
              >
                {labels.register}
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              style={{
                display: "block",
                textAlign: "center",
                padding: "11px",
                borderRadius: 8,
                background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                fontFamily: "var(--font-sans)",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#070809",
                textDecoration: "none",
              }}
            >
              {labels.dashboard}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
