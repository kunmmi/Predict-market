"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { signupSchema } from "@/lib/validations/auth";
import type { Locale, T } from "@/lib/i18n/translations";

type SignupFormValues = z.infer<typeof signupSchema>;
type PromoCodeStatus = "idle" | "checking" | "valid" | "invalid";

type Props = { locale: Locale; t: T["auth"] };

export function SignupForm({ locale, t }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [promoStatus, setPromoStatus] = React.useState<PromoCodeStatus>("idle");
  const [promoMessage, setPromoMessage] = React.useState<string | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: undefined,
      promoCode: searchParams.get("ref")?.toUpperCase() ?? undefined,
    },
  });

  function handlePromoCodeChange(value: string) {
    const normalized = value.trim().toUpperCase();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (normalized.length < 4) { setPromoStatus("idle"); setPromoMessage(null); return; }
    setPromoStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/referrals/validate-code?code=${encodeURIComponent(normalized)}`);
        const json = (await res.json()) as { valid: boolean; message?: string };
        if (json.valid) { setPromoStatus("valid"); setPromoMessage(null); }
        else { setPromoStatus("invalid"); setPromoMessage(json.message ?? "Invalid promo code."); }
      } catch { setPromoStatus("idle"); setPromoMessage(null); }
    }, 500);
  }

  async function onSubmit(values: SignupFormValues) {
    setErrorMessage(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (!res.ok || !json?.success) { setErrorMessage(json?.message ?? "Signup failed."); return; }
    router.refresh();
    router.push("/dashboard");
  }

  const promoCodeValue = form.watch("promoCode");

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
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t.signup_eyebrow}</p>
            <CardTitle>{t.signup_title}</CardTitle>
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
                <label className="text-sm font-medium text-slate-700" htmlFor="fullName">{t.full_name}</label>
                <Input id="fullName" type="text" autoComplete="name" {...form.register("fullName")} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="password">{t.password}</label>
                <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
                {form.formState.errors.password?.message && (
                  <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="promoCode">{t.promo_code}</label>
                <div className="relative">
                  <Input
                    id="promoCode"
                    type="text"
                    autoComplete="off"
                    placeholder={t.promo_placeholder}
                    className="uppercase"
                    {...form.register("promoCode", {
                      onChange: (e) => handlePromoCodeChange(e.target.value),
                    })}
                  />
                  {promoCodeValue && promoCodeValue.trim().length >= 4 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                      {promoStatus === "checking" && <span className="text-slate-400">...</span>}
                      {promoStatus === "valid" && <span className="text-green-600">&#10003;</span>}
                      {promoStatus === "invalid" && <span className="text-red-500">&#10007;</span>}
                    </span>
                  )}
                </div>
                {form.formState.errors.promoCode?.message ? (
                  <p className="text-sm text-red-600">{form.formState.errors.promoCode.message}</p>
                ) : promoStatus === "invalid" && promoMessage ? (
                  <p className="text-sm text-red-600">{promoMessage}</p>
                ) : promoStatus === "valid" ? (
                  <p className="text-sm text-emerald-600">{t.promo_accepted}</p>
                ) : null}
              </div>

              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                {form.formState.isSubmitting ? t.creating : t.create}
              </Button>
              <p className="text-center text-sm text-slate-600">
                {t.have_account}{" "}
                <Link href="/login" className="font-medium text-slate-900 underline underline-offset-4 hover:text-yellow-600">
                  {t.sign_in_link}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
