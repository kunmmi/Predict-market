"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Locale, T } from "@/lib/i18n/translations";

type Props = { locale: Locale; t: T["auth"] };

export function ForgotPasswordForm({ locale, t }: Props) {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.message ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--bg-base)" }}>
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6" style={{ height: 56 }}>
          <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <LanguageSwitcher locale={locale} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md animate-fade-up">
          <CardHeader>
            <p
              style={{
                fontSize: "0.6875rem",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "var(--text-dim)",
              }}
            >
              {t.forgot_eyebrow}
            </p>
            <CardTitle>{t.forgot_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div
                  style={{
                    borderRadius: 8,
                    border: "1px solid rgba(13,184,145,0.3)",
                    backgroundColor: "var(--teal-dim)",
                    padding: "12px 16px",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--teal)",
                  }}
                >
                  {t.reset_sent}
                </div>
                <Link
                  href="/login"
                  style={{
                    display: "block",
                    textAlign: "center",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    textDecoration: "underline",
                    textUnderlineOffset: 4,
                  }}
                  className="hover:text-[var(--gold)]"
                >
                  {t.back_to_login}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{t.forgot_instructions}</p>

                {error && (
                  <div
                    style={{
                      borderRadius: 8,
                      border: "1px solid rgba(232,68,90,0.3)",
                      backgroundColor: "var(--rose-dim)",
                      padding: "12px 16px",
                      fontSize: "0.875rem",
                      color: "var(--rose)",
                    }}
                  >
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label
                    style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}
                    htmlFor="email"
                  >
                    {t.email}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? t.sending : t.send_reset_link}
                </Button>

                <p style={{ textAlign: "center", fontSize: "0.875rem" }}>
                  <Link
                    href="/login"
                    style={{
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      textDecoration: "underline",
                      textUnderlineOffset: 4,
                    }}
                    className="hover:text-[var(--gold)]"
                  >
                    {t.back_to_login}
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
