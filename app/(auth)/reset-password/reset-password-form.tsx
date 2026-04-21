"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import type { Locale, T } from "@/lib/i18n/translations";

type Props = { locale: Locale; t: T["auth"] };

export function ResetPasswordForm({ locale, t }: Props) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t.password_min);
      return;
    }
    if (password !== confirm) {
      setError(t.passwords_no_match);
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
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
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t.reset_eyebrow}</p>
            <CardTitle>{t.reset_title}</CardTitle>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                  {t.reset_success}
                </div>
                <p className="text-center text-sm text-slate-500">Redirecting to sign in...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="password">
                    {t.new_password}
                  </label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="confirm">
                    {t.confirm_password}
                  </label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? t.updating : t.update_password}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
