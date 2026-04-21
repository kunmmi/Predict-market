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
import { signupSchema, signupUsernameSchema } from "@/lib/validations/auth";
import type { Locale, T } from "@/lib/i18n/translations";

type EmailFormValues = z.infer<typeof signupSchema>;
type UsernameFormValues = z.infer<typeof signupUsernameSchema>;
type PromoCodeStatus = "idle" | "checking" | "valid" | "invalid";
type Tab = "email" | "username";

type Props = { locale: Locale; t: T["auth"] };

export function SignupForm({ locale, t }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<Tab>("email");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [promoStatus, setPromoStatus] = React.useState<PromoCodeStatus>("idle");
  const [promoMessage, setPromoMessage] = React.useState<string | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: undefined,
      promoCode: searchParams.get("ref")?.toUpperCase() ?? undefined,
    },
  });

  const usernameForm = useForm<UsernameFormValues>({
    resolver: zodResolver(signupUsernameSchema),
    defaultValues: {
      username: "",
      password: "",
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

  async function onEmailSubmit(values: EmailFormValues) {
    setErrorMessage(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, mode: "email" }),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (!res.ok || !json?.success) { setErrorMessage(json?.message ?? "Signup failed."); return; }
    router.refresh();
    router.push("/dashboard");
  }

  async function onUsernameSubmit(values: UsernameFormValues) {
    setErrorMessage(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, mode: "username" }),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (!res.ok || !json?.success) { setErrorMessage(json?.message ?? "Signup failed."); return; }
    router.refresh();
    router.push("/dashboard");
  }

  const promoCodeValue =
    tab === "email" ? emailForm.watch("promoCode") : usernameForm.watch("promoCode");

  const promoField = (register: typeof emailForm.register | typeof usernameForm.register) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700" htmlFor="promoCode">
        {t.promo_code}
      </label>
      <div className="relative">
        <Input
          id="promoCode"
          type="text"
          autoComplete="off"
          placeholder={t.promo_placeholder}
          className="uppercase"
          {...(register as typeof emailForm.register)("promoCode" as never, {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              handlePromoCodeChange(e.target.value),
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
      {promoStatus === "invalid" && promoMessage ? (
        <p className="text-sm text-red-600">{promoMessage}</p>
      ) : promoStatus === "valid" ? (
        <p className="text-sm text-emerald-600">{t.promo_accepted}</p>
      ) : null}
    </div>
  );

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
          <CardContent className="space-y-4">
            {/* Tab Toggle */}
            <div className="flex rounded-md border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => { setTab("email"); setErrorMessage(null); }}
                className={`flex-1 rounded py-1.5 text-sm font-medium transition-colors ${
                  tab === "email"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.tab_email}
              </button>
              <button
                type="button"
                onClick={() => { setTab("username"); setErrorMessage(null); }}
                className={`flex-1 rounded py-1.5 text-sm font-medium transition-colors ${
                  tab === "username"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.tab_username}
              </button>
            </div>

            {/* Email signup form */}
            {tab === "email" && (
              <form className="space-y-4" onSubmit={emailForm.handleSubmit(onEmailSubmit)}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="email">{t.email}</label>
                  <Input id="email" type="email" autoComplete="email" {...emailForm.register("email")} />
                  {emailForm.formState.errors.email?.message && (
                    <p className="text-sm text-red-600">{emailForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="fullName">{t.full_name}</label>
                  <Input id="fullName" type="text" autoComplete="name" {...emailForm.register("fullName")} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="password-email">{t.password}</label>
                  <Input id="password-email" type="password" autoComplete="new-password" {...emailForm.register("password")} />
                  {emailForm.formState.errors.password?.message && (
                    <p className="text-sm text-red-600">{emailForm.formState.errors.password.message}</p>
                  )}
                </div>

                {promoField(emailForm.register)}

                {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

                <Button type="submit" disabled={emailForm.formState.isSubmitting} className="w-full">
                  {emailForm.formState.isSubmitting ? t.creating : t.create}
                </Button>

                <p className="text-center text-sm text-slate-600">
                  {t.have_account}{" "}
                  <Link href="/login" className="font-medium text-slate-900 underline underline-offset-4 hover:text-yellow-600">
                    {t.sign_in_link}
                  </Link>
                </p>
              </form>
            )}

            {/* Username signup form */}
            {tab === "username" && (
              <form className="space-y-4" onSubmit={usernameForm.handleSubmit(onUsernameSubmit)}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="username">{t.username}</label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder={t.username_placeholder}
                    {...usernameForm.register("username")}
                  />
                  {usernameForm.formState.errors.username?.message && (
                    <p className="text-sm text-red-600">{usernameForm.formState.errors.username.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="password-username">{t.password}</label>
                  <Input id="password-username" type="password" autoComplete="new-password" {...usernameForm.register("password")} />
                  {usernameForm.formState.errors.password?.message && (
                    <p className="text-sm text-red-600">{usernameForm.formState.errors.password.message}</p>
                  )}
                </div>

                {promoField(usernameForm.register)}

                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {t.username_no_reset}
                </p>

                {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

                <Button type="submit" disabled={usernameForm.formState.isSubmitting} className="w-full">
                  {usernameForm.formState.isSubmitting ? t.creating : t.create}
                </Button>

                <p className="text-center text-sm text-slate-600">
                  {t.have_account}{" "}
                  <Link href="/login" className="font-medium text-slate-900 underline underline-offset-4 hover:text-yellow-600">
                    {t.sign_in_link}
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
