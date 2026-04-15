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
import { getSafeNextPath } from "@/lib/helpers/safe-next-path";
import { loginSchema } from "@/lib/validations/auth";
import type { Locale, T } from "@/lib/i18n/translations";

type LoginFormValues = z.infer<typeof loginSchema>;
type Props = { locale: Locale; t: T["auth"] };

export function LoginForm({ locale, t }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setErrorMessage(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (!res.ok || !json?.success) { setErrorMessage(json?.message ?? "Login failed."); return; }
    const next = getSafeNextPath(searchParams.get("next"));
    router.refresh();
    router.push(next);
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
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t.login_eyebrow}</p>
            <CardTitle>{t.login_title}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="email">{t.email}</label>
                <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
                {form.formState.errors.email?.message && (
                  <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">{t.password}</label>
                <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
                {form.formState.errors.password?.message && (
                  <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
                )}
              </div>

              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                {form.formState.isSubmitting ? t.signing_in : t.sign_in}
              </Button>
              <p className="text-center text-sm text-slate-600">
                {t.no_account}{" "}
                <Link href="/signup" className="font-medium text-slate-900 underline underline-offset-4 hover:text-yellow-600">
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
