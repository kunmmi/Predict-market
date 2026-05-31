"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getSafeNextPath } from "@/lib/helpers/safe-next-path";
import { loginSchema } from "@/lib/validations/auth";
import type { Locale, T } from "@/lib/i18n/translations";

type LoginFormValues = { identifier: string; password: string };
type Props = { locale: Locale; t: T["auth"] };

export function LoginForm({ locale, t }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setErrorMessage(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: values.identifier, password: values.password }),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (!res.ok || !json?.success) { setErrorMessage(json?.message ?? "Login failed."); return; }
    const next = getSafeNextPath(searchParams.get("next"));
    router.refresh();
    router.push(next);
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
              {t.login_eyebrow}
            </p>
            <CardTitle>{t.login_title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <label
                  style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}
                  htmlFor="identifier"
                >
                  {t.email_or_username}
                </label>
                <Input id="identifier" type="text" autoComplete="username" {...form.register("identifier")} />
                {form.formState.errors.identifier?.message && (
                  <p style={{ fontSize: "0.875rem", color: "var(--rose)" }}>{form.formState.errors.identifier.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}
                    htmlFor="password"
                  >
                    {t.password}
                  </label>
                  <Link
                    href="/forgot-password"
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-dim)",
                      textDecoration: "underline",
                      textUnderlineOffset: 4,
                    }}
                    className="hover:text-[var(--gold)]"
                  >
                    {t.forgot_password}
                  </Link>
                </div>
                <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
                {form.formState.errors.password?.message && (
                  <p style={{ fontSize: "0.875rem", color: "var(--rose)" }}>{form.formState.errors.password.message}</p>
                )}
              </div>

              {errorMessage && <p style={{ fontSize: "0.875rem", color: "var(--rose)" }}>{errorMessage}</p>}

              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                {form.formState.isSubmitting ? t.signing_in : t.sign_in}
              </Button>
              <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                {t.no_account}{" "}
                <Link
                  href="/signup"
                  style={{
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    textDecoration: "underline",
                    textUnderlineOffset: 4,
                  }}
                  className="hover:text-[var(--gold)]"
                >
                  {t.create_account_link}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
