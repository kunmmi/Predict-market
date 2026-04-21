"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
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
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-700 bg-slate-900">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="rounded bg-yellow-400 p-1.5 text-slate-900">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">Elemental</span>
          </Link>
          <LanguageSwitcher locale={locale} />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md animate-fade-up">
          <CardHeader>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t.forgot_eyebrow}</p>
            <CardTitle>{t.forgot_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                  {t.reset_sent}
                </div>
                <Link
                  href="/login"
                  className="block text-center text-sm font-medium text-slate-900 underline underline-offset-4 hover:text-yellow-600"
                >
                  {t.back_to_login}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-600">{t.forgot_instructions}</p>

                {error && (
                  <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="email">
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

                <p className="text-center text-sm text-slate-600">
                  <Link
                    href="/login"
                    className="font-medium text-slate-900 underline underline-offset-4 hover:text-yellow-600"
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
