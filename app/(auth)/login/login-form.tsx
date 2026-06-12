"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  const isZh = locale === "zh";

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
    <>
      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(var(--gold-rgb, 212,175,55), 0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(var(--gold-rgb, 212,175,55), 0); }
          100% { box-shadow: 0 0 0 0 rgba(var(--gold-rgb, 212,175,55), 0); }
        }
        @keyframes fade-up-stagger {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        .promo-fade-1 { animation: fade-up-stagger 0.55s ease both; animation-delay: 0.05s; }
        .promo-fade-2 { animation: fade-up-stagger 0.55s ease both; animation-delay: 0.15s; }
        .promo-fade-3 { animation: fade-up-stagger 0.55s ease both; animation-delay: 0.25s; }
        .promo-fade-4 { animation: fade-up-stagger 0.55s ease both; animation-delay: 0.35s; }
        .promo-fade-5 { animation: fade-up-stagger 0.55s ease both; animation-delay: 0.45s; }
        .live-badge   { animation: pulse-ring 2s ease-out infinite; }
        .ball-float   { animation: float 3.5s ease-in-out infinite; }
        .gold-shimmer {
          background: linear-gradient(90deg,
            var(--gold) 0%,
            #fff8dc 40%,
            var(--gold) 60%,
            var(--gold-btn-light) 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3.5s linear infinite;
        }
        /* diagonal grid texture */
        .diagonal-grid {
          background-image:
            repeating-linear-gradient(
              45deg,
              rgba(255,255,255,0.018) 0px,
              rgba(255,255,255,0.018) 1px,
              transparent 1px,
              transparent 28px
            ),
            repeating-linear-gradient(
              -45deg,
              rgba(255,255,255,0.018) 0px,
              rgba(255,255,255,0.018) 1px,
              transparent 1px,
              transparent 28px
            );
        }
        .feature-row:hover .feature-icon-wrap {
          border-color: var(--gold);
          background: rgba(212,175,55,0.08);
          transition: all 0.2s;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-base)" }}>

        {/* ── Top nav ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          borderBottom: "1px solid var(--border-dim)",
          background: "var(--bg-nav-glass)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
          <div style={{
            maxWidth: 1280, margin: "0 auto", padding: "0 24px",
            height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                boxShadow: "0 0 12px var(--gold-glow)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <BarChart3 style={{ width: 14, height: 14, color: "#070809" }} />
              </div>
              <span style={{
                fontFamily: "var(--font-display)", fontSize: "1.0625rem", fontWeight: 600,
                letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-primary)",
              }}>
                Predict Market
              </span>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ThemeToggle />
              <LanguageSwitcher locale={locale} />
            </div>
          </div>
        </header>

        {/* ── Mobile banner ── */}
        <div style={{
          display: "block",
          background: "linear-gradient(90deg, #0a0b0c 0%, #111214 100%)",
          borderBottom: "1px solid var(--border-dim)",
          padding: "14px 20px",
        }} className="lg:hidden">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>⚽</span>
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 1 }}>
                {isZh ? "2026 世界杯 · 现已开放" : "2026 World Cup · Now Live"}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-dim)", lineHeight: 1.4 }}>
                {isZh
                  ? "72场比赛 · 推广员计划 · 实时结算"
                  : "72 matches · Promoter commissions · Real-time settlement"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: "flex" }}>

          {/* ════════ LEFT PROMO PANEL ════════ */}
          <div
            className="diagonal-grid hidden lg:flex"
            style={{
              flex: "0 0 52%",
              flexDirection: "column",
              justifyContent: "center",
              padding: "clamp(28px, 5vh, 56px) 72px",
              position: "relative",
              overflow: "hidden",
              background: "linear-gradient(160deg, #0c0d0f 0%, #08090a 55%, #0c0f0b 100%)",
              borderRight: "1px solid var(--border-dim)",
            }}
          >
            {/* Ambient glow blobs */}
            <div style={{
              position: "absolute", top: -120, left: -80, width: 420, height: 420, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", bottom: -100, right: -60, width: 360, height: 360, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(34,120,34,0.06) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* ── World Cup section ── */}
            <div style={{ position: "relative", marginBottom: "clamp(18px, 3vh, 36px)" }}>

              {/* LIVE NOW badge */}
              <div className="promo-fade-1" style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 10 }}>
                <div className="live-badge" style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  background: "linear-gradient(135deg, var(--gold-btn-light), var(--gold-btn))",
                  borderRadius: 999, padding: "5px 14px",
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#070809", flexShrink: 0,
                    boxShadow: "0 0 0 2px rgba(0,0,0,0.3)",
                  }} />
                  <span style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#070809" }}>
                    {isZh ? "正在进行" : "Live Now"}
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", letterSpacing: "0.05em" }}>
                  {isZh ? "开幕战已开始" : "Opening match underway"}
                </span>
              </div>

              {/* Headline */}
              <div className="promo-fade-2" style={{ marginBottom: 6 }}>
                <p style={{
                  fontFamily: "var(--font-display)", fontSize: "0.875rem", fontWeight: 500,
                  letterSpacing: "0.3em", textTransform: "uppercase",
                  color: "var(--text-dim)", marginBottom: 8,
                }}>
                  FIFA {isZh ? "世界杯" : "World Cup"}
                </p>
                <h2 style={{
                  fontFamily: "var(--font-display)", fontWeight: 800,
                  fontSize: "clamp(1.9rem, 2.8vw, 2.6rem)", lineHeight: 1.05,
                  color: "var(--text-primary)", margin: 0,
                }}>
                  <span className="gold-shimmer">2026</span>
                  <br />
                  <span style={{ color: "var(--text-primary)" }}>{isZh ? "预测竞技场" : "Prediction Arena"}</span>
                </h2>
              </div>

              {/* Feature rows — compact */}
              <div className="promo-fade-3" style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 14 }}>
                {[
                  { emoji: "⚽", en: "72 matches · 48 teams · 12 groups (A–L)",   zh: "72 场比赛 · 48 支球队 · 12 个小组" },
                  { emoji: "📊", en: "Parimutuel pools — winners split the pot",   zh: "奖池制赔率 — 赢家瓜分全部下注池" },
                  { emoji: "⚡", en: "SOL & crypto live markets",                   zh: "SOL 等加密货币实时市场" },
                  { emoji: "🔔", en: "Push alerts for kick-offs & results",         zh: "比赛开始与结果实时推送" },
                ].map(({ emoji, en, zh }) => (
                  <div key={en} className="feature-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="feature-icon-wrap" style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      border: "1px solid var(--border-dim)",
                      background: "rgba(255,255,255,0.03)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem",
                      transition: "all 0.2s",
                    }}>
                      {emoji}
                    </div>
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.3 }}>
                      {isZh ? zh : en}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="promo-fade-4" style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: "clamp(12px, 2vh, 20px)",
            }}>
              <div style={{ flex: 1, height: 1, background: "var(--border-dim)" }} />
              <span style={{ fontSize: "0.6875rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-dim)" }}>
                {isZh ? "也可以" : "Also"}
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border-dim)" }} />
            </div>

            {/* ── Promoter card ── */}
            <div className="promo-fade-5" style={{
              borderRadius: 16, padding: "18px 22px",
              border: "1px solid rgba(212,175,55,0.2)",
              background: "linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(212,175,55,0.02) 100%)",
              position: "relative", overflow: "hidden",
            }}>
              {/* card corner accent */}
              <div style={{
                position: "absolute", top: 0, right: 0,
                width: 80, height: 80,
                background: "radial-gradient(circle at top right, rgba(212,175,55,0.15), transparent 70%)",
                pointerEvents: "none",
              }} />

              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                <div className="ball-float" style={{ fontSize: "1.75rem", lineHeight: 1, marginTop: 2 }}>💰</div>
                <div>
                  <p style={{
                    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.0625rem",
                    color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.2,
                  }}>
                    {isZh ? "成为推广员，赚取佣金" : "Earn as a Promoter"}
                  </p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                    {isZh
                      ? "获取专属邀请码，推荐好友即可从他们每一笔下注中持续赚取佣金，随时可提现。"
                      : "Get your unique promo code. Earn a commission cut from every bet your referrals place — tracked in real time, claimable any time."}
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1, borderRadius: 10, overflow: "hidden",
                border: "1px solid rgba(212,175,55,0.15)",
                background: "rgba(212,175,55,0.08)",
              }}>
                {[
                  { val: isZh ? "专属邀请码" : "Unique code",        sub: isZh ? "即时获取" : "Instant access" },
                  { val: isZh ? "实时佣金"   : "Live commissions",   sub: isZh ? "逐笔记录" : "Per-bet tracked" },
                  { val: isZh ? "随时提现"   : "Claim anytime",      sub: isZh ? "无最低门槛" : "No minimum"   },
                ].map(({ val, sub }) => (
                  <div key={val} style={{
                    padding: "10px 12px",
                    background: "rgba(0,0,0,0.25)",
                    textAlign: "center",
                  }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gold)", marginBottom: 2 }}>{val}</p>
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-dim)" }}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ════════ RIGHT LOGIN PANEL ════════ */}
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(24px, 4vh, 48px) 24px",
          }}>
            <Card className="w-full animate-fade-up" style={{ maxWidth: 420 }}>
              <CardHeader>
                <p style={{
                  fontSize: "0.6875rem", textTransform: "uppercase",
                  letterSpacing: "0.2em", color: "var(--text-dim)", marginBottom: 4,
                }}>
                  {t.login_eyebrow}
                </p>
                <CardTitle>{t.login_title}</CardTitle>
              </CardHeader>

              <CardContent>
                <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="space-y-2">
                    <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }} htmlFor="identifier">
                      {t.email_or_username}
                    </label>
                    <Input id="identifier" type="text" autoComplete="username" {...form.register("identifier")} />
                    {form.formState.errors.identifier?.message && (
                      <p style={{ fontSize: "0.875rem", color: "var(--rose)" }}>{form.formState.errors.identifier.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }} htmlFor="password">
                        {t.password}
                      </label>
                      <Link
                        href="/forgot-password"
                        style={{ fontSize: "0.75rem", color: "var(--text-dim)", textDecoration: "underline", textUnderlineOffset: 4 }}
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

                  {errorMessage && (
                    <p style={{ fontSize: "0.875rem", color: "var(--rose)" }}>{errorMessage}</p>
                  )}

                  <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                    {form.formState.isSubmitting ? t.signing_in : t.sign_in}
                  </Button>

                  <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    {t.no_account}{" "}
                    <Link
                      href="/signup"
                      style={{ fontWeight: 500, color: "var(--text-primary)", textDecoration: "underline", textUnderlineOffset: 4 }}
                      className="hover:text-[var(--gold)]"
                    >
                      {t.create_account_link}
                    </Link>
                  </p>
                </form>

                {/* ── Right-panel mini promo (desktop only, below form) ── */}
                <div className="hidden lg:block" style={{ marginTop: 28 }}>
                  <div style={{
                    borderRadius: 10,
                    border: "1px solid var(--border-dim)",
                    background: "var(--bg-card)",
                    padding: "14px 16px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>⚽</span>
                    <p style={{ fontSize: "0.8125rem", color: "var(--text-dim)", lineHeight: 1.5 }}>
                      {isZh
                        ? "今天就开始：预测2026世界杯开幕战，墨西哥 vs 南非"
                        : "Kick off today — predict Mexico vs South Africa, the 2026 opening match."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </>
  );
}
