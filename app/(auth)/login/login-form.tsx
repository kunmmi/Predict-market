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
        @keyframes gold-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulse-live {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
          50%       { opacity: 0.75; box-shadow: 0 0 0 5px rgba(34,197,94,0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes coin-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%       { transform: translateY(-9px) rotate(2deg); }
        }
        @keyframes card-glow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(212,175,55,0.18), 0 8px 40px rgba(212,175,55,0.06); }
          50%       { box-shadow: 0 0 0 1px rgba(212,175,55,0.45), 0 8px 60px rgba(212,175,55,0.14); }
        }

        .lf-gold {
          background: linear-gradient(90deg, #a87820 0%, #f5d97a 30%, #fffacd 50%, #f5d97a 70%, #a87820 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gold-shimmer 4s linear infinite;
        }
        .lf-enter-1 { animation: fade-in-up 0.65s cubic-bezier(0.16,1,0.3,1) both 0.05s; }
        .lf-enter-2 { animation: fade-in-up 0.65s cubic-bezier(0.16,1,0.3,1) both 0.18s; }
        .lf-enter-3 { animation: fade-in-up 0.65s cubic-bezier(0.16,1,0.3,1) both 0.32s; }
        .lf-enter-4 { animation: fade-in-up 0.65s cubic-bezier(0.16,1,0.3,1) both 0.46s; }
        .lf-live    { animation: pulse-live 1.6s ease-in-out infinite; }
        .lf-coin    { animation: coin-bob 4s ease-in-out infinite; }
        .lf-vip     { animation: card-glow 3s ease-in-out infinite; }

        /* Hexagonal grid overlay */
        .lf-hex {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='104' viewBox='0 0 60 104'%3E%3Cpath d='M30 2l28 16v32L30 66 2 50V18L30 2zM30 54l28 16v32L30 118 2 102V70L30 54z' fill='none' stroke='rgba(212,175,55,0.035)' stroke-width='1'/%3E%3C/svg%3E");
          background-size: 60px 104px;
        }

        /* Input styles */
        .lf-input {
          background: rgba(255,255,255,0.04) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #fff !important;
          border-radius: 10px !important;
          padding: 12px 14px !important;
          font-size: 0.9375rem !important;
          transition: border-color 0.2s, box-shadow 0.2s !important;
        }
        .lf-input:focus {
          outline: none !important;
          border-color: rgba(212,175,55,0.55) !important;
          box-shadow: 0 0 0 3px rgba(212,175,55,0.1) !important;
        }
        .lf-input::placeholder { color: rgba(255,255,255,0.2) !important; }

        /* Submit button */
        .lf-submit {
          background: linear-gradient(135deg, #f0d060 0%, #d4af37 55%, #b8932a 100%) !important;
          color: #060708 !important;
          font-weight: 800 !important;
          font-size: 0.875rem !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
          border: none !important;
          border-radius: 10px !important;
          height: 48px !important;
          box-shadow: 0 4px 24px rgba(212,175,55,0.35) !important;
          transition: transform 0.18s, box-shadow 0.18s !important;
        }
        .lf-submit:hover:not(:disabled) {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 32px rgba(212,175,55,0.5) !important;
        }
        .lf-submit:disabled { opacity: 0.55 !important; }

        /* VIP join button */
        .lf-join {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #f0d060 0%, #d4af37 100%);
          border-radius: 10px; text-decoration: none;
          font-weight: 800; font-size: 0.8125rem; color: #060708;
          letter-spacing: 0.07em; text-transform: uppercase;
          box-shadow: 0 4px 20px rgba(212,175,55,0.4);
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .lf-join:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(212,175,55,0.55);
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#07080a" }}>

        {/* ── Nav ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(7,8,10,0.88)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            maxWidth: 1400, margin: "0 auto", padding: "0 24px",
            height: 58, display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: "linear-gradient(135deg, #f0d060 0%, #b8932a 100%)",
                boxShadow: "0 0 16px rgba(212,175,55,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <BarChart3 style={{ width: 15, height: 15, color: "#070809" }} />
              </div>
              <span style={{
                fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff",
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

        {/* ══════════════════════════════════════
            MOBILE PROMOTER BANNER
        ══════════════════════════════════════ */}
        <div className="lg:hidden" style={{
          position: "relative", overflow: "hidden",
          background: "linear-gradient(110deg, #0b0900 0%, #100e02 55%, #080b06 100%)",
          borderBottom: "1px solid rgba(212,175,55,0.18)",
        }}>
          {/* ambient glow */}
          <div style={{
            position: "absolute", top: -40, right: 80, width: 180, height: 180, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "stretch" }}>
            {/* Left: headline + CTA */}
            <div style={{ flex: 1, padding: "14px 16px 14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span className="lf-live" style={{
                  display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                  background: "#22c55e",
                }} />
                <span style={{
                  fontSize: "0.5625rem", fontWeight: 800, letterSpacing: "0.22em",
                  textTransform: "uppercase", color: "rgba(212,175,55,0.75)",
                }}>
                  {isZh ? "推广员计划" : "Promoter Program"}
                </span>
              </div>
              <p style={{
                fontSize: "0.9375rem", fontWeight: 800, color: "#fff",
                lineHeight: 1.25, marginBottom: 10,
              }}>
                {isZh ? "好友每次下注，你都赚钱" : "Get paid on every\nfriend's bet"}
              </p>
              <Link href="/promoter/register" className="lf-join" style={{
                display: "inline-flex", padding: "6px 16px",
                fontSize: "0.6875rem", borderRadius: 20, height: "auto",
              }}>
                {isZh ? "立即加入 →" : "Join free →"}
              </Link>
            </div>

            {/* Right: BIG 30% */}
            <div style={{
              flexShrink: 0, width: 108,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              borderLeft: "1px solid rgba(212,175,55,0.12)",
              background: "rgba(212,175,55,0.04)",
              padding: "12px 8px",
            }}>
              <p className="lf-gold" style={{
                fontFamily: "var(--font-display)", fontSize: "2.75rem",
                fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 3,
              }}>
                30%
              </p>
              <p style={{
                fontSize: "0.5625rem", color: "rgba(212,175,55,0.55)",
                textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center", lineHeight: 1.4,
              }}>
                {isZh ? "每笔\n佣金" : "per bet\ncommission"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: "flex" }}>

          {/* ══════════════════════════════════════
              LEFT PROMO PANEL (desktop only)
          ══════════════════════════════════════ */}
          <div
            className="lf-hex hidden lg:flex"
            style={{
              flex: "0 0 54%",
              flexDirection: "column",
              justifyContent: "center",
              padding: "clamp(32px,5vh,64px) clamp(44px,5vw,84px)",
              position: "relative",
              overflow: "hidden",
              background: "linear-gradient(150deg, #08090c 0%, #060708 45%, #070a08 100%)",
              borderRight: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            {/* Stadium light rays (conic) */}
            <div style={{
              position: "absolute", top: -120, right: -80, width: 700, height: 700,
              background: "conic-gradient(from 218deg at 100% 0%, transparent 0deg, rgba(212,175,55,0.05) 9deg, transparent 18deg, rgba(212,175,55,0.03) 30deg, transparent 40deg)",
              pointerEvents: "none",
              transform: "scale(1.4)",
            }} />
            {/* Pitch green glow */}
            <div style={{
              position: "absolute", bottom: -180, left: "50%", transform: "translateX(-50%)",
              width: 800, height: 400,
              background: "radial-gradient(ellipse, rgba(34,197,94,0.05) 0%, transparent 65%)",
              pointerEvents: "none",
            }} />
            {/* Gold ambient blob */}
            <div style={{
              position: "absolute", top: -100, left: -100, width: 550, height: 550,
              background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 60%)",
              pointerEvents: "none",
            }} />

            {/* LIVE badge */}
            <div className="lf-enter-1" style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.28)",
                borderRadius: 999, padding: "6px 16px",
              }}>
                <span className="lf-live" style={{
                  display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                  background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.9)",
                }} />
                <span style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "#22c55e" }}>
                  {isZh ? "赛事进行中" : "Live Now"}
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>
                {isZh ? "FIFA 2026 世界杯 · 小组赛" : "FIFA World Cup 2026 · Group Stage"}
              </span>
            </div>

            {/* Hero headline */}
            <div className="lf-enter-2" style={{ marginBottom: "clamp(28px,4vh,48px)" }}>
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 600,
                letterSpacing: "0.38em", textTransform: "uppercase",
                color: "rgba(212,175,55,0.45)", marginBottom: 4,
              }}>
                FIFA {isZh ? "世界杯" : "World Cup"} · {isZh ? "预测竞技场" : "Prediction Arena"}
              </p>

              <h1 style={{
                fontFamily: "var(--font-display)", fontWeight: 900,
                fontSize: "clamp(4.5rem, 9vw, 8rem)",
                lineHeight: 0.9, margin: "0 0 10px", letterSpacing: "-0.04em",
              }}>
                <span className="lf-gold">2026</span>
              </h1>

              <p style={{
                fontFamily: "var(--font-display)", fontWeight: 700,
                fontSize: "clamp(1.4rem, 2.6vw, 2.1rem)",
                color: "rgba(255,255,255,0.88)", margin: 0, letterSpacing: "-0.01em",
              }}>
                {isZh ? "预测. 竞争. 获胜." : "Predict. Compete. Win."}
              </p>

              <p style={{
                fontSize: "0.9rem", color: "rgba(255,255,255,0.38)",
                lineHeight: 1.65, maxWidth: 400, marginTop: 14,
              }}>
                {isZh
                  ? "72场小组赛 · A至L组 · 48支球队。奖池制赔率，赢家瓜分全部下注池。"
                  : "72 group-stage matches · 12 groups · 48 teams. Parimutuel pools — winners take the entire pot."}
              </p>
            </div>

            {/* ── VIP Promoter card ── */}
            <div className="lf-enter-3 lf-vip" style={{
              borderRadius: 18,
              border: "1px solid rgba(212,175,55,0.22)",
              background: "linear-gradient(140deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.02) 50%, rgba(0,0,0,0.35) 100%)",
              position: "relative", overflow: "hidden",
              backdropFilter: "blur(12px)",
            }}>
              {/* Gold top bar */}
              <div style={{
                height: 3,
                background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.5) 25%, rgba(255,236,140,0.95) 50%, rgba(212,175,55,0.5) 75%, transparent 100%)",
              }} />

              {/* VIP corner ribbon */}
              <div style={{
                position: "absolute", top: 3, right: 0,
                width: 0, height: 0, borderStyle: "solid",
                borderWidth: "0 54px 54px 0",
                borderColor: "transparent rgba(212,175,55,0.18) transparent transparent",
                pointerEvents: "none",
              }} />
              <div style={{
                position: "absolute", top: 10, right: 5,
                fontSize: "0.45rem", fontWeight: 900, color: "rgba(212,175,55,0.9)",
                letterSpacing: "0.06em", transform: "rotate(45deg)", pointerEvents: "none",
              }}>VIP</div>

              <div style={{ padding: "20px 26px 24px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                  <div style={{ flex: 1, paddingRight: 16 }}>
                    <p style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700,
                      letterSpacing: "0.28em", textTransform: "uppercase",
                      color: "rgba(212,175,55,0.55)", marginBottom: 7,
                    }}>
                      {isZh ? "独家推广员计划" : "Exclusive Promoter Program"}
                    </p>
                    <p style={{
                      fontFamily: "var(--font-display)", fontWeight: 800,
                      fontSize: "1.25rem", color: "#fff", lineHeight: 1.2, marginBottom: 8,
                    }}>
                      {isZh ? "成为推广员，坐享佣金" : "Earn on Every Friend's Bet"}
                    </p>
                    <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.42)", lineHeight: 1.55 }}>
                      {isZh
                        ? "分享专属邀请码，好友每笔下注你赚 30% 佣金，实时入账，无需等待。"
                        : "Share your promo code — earn 30% of every bet your referrals place, credited in real time."}
                    </p>
                  </div>
                  <div className="lf-coin" style={{ flexShrink: 0 }}>
                    <div style={{
                      width: 58, height: 58, borderRadius: "50%",
                      background: "linear-gradient(135deg, #f5d97a 0%, #d4af37 50%, #a87820 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.6rem",
                      boxShadow: "0 4px 24px rgba(212,175,55,0.5), 0 0 0 5px rgba(212,175,55,0.1)",
                    }}>
                      💰
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18,
                }}>
                  {[
                    { val: "30%", sub: isZh ? "每笔佣金" : "Per-bet cut", featured: true },
                    { val: isZh ? "即时到账" : "Instant", sub: isZh ? "实时结算" : "Real-time", featured: false },
                    { val: isZh ? "无门槛" : "No min.", sub: isZh ? "随时提现" : "Claim anytime", featured: false },
                  ].map(({ val, sub, featured }) => (
                    <div key={val} style={{
                      padding: "11px 8px", borderRadius: 10, textAlign: "center",
                      background: featured ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${featured ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                      <p style={{
                        fontFamily: featured ? "var(--font-display)" : "inherit",
                        fontSize: featured ? "1.25rem" : "0.875rem",
                        fontWeight: 800, lineHeight: 1, marginBottom: 4,
                        color: featured ? "var(--gold)" : "rgba(255,255,255,0.78)",
                      }}>{val}</p>
                      <p style={{
                        fontSize: "0.5625rem", textTransform: "uppercase",
                        letterSpacing: "0.1em", color: "rgba(255,255,255,0.28)",
                      }}>{sub}</p>
                    </div>
                  ))}
                </div>

                <Link href="/promoter/register" className="lf-join">
                  {isZh ? "立即加入推广员计划 →" : "Join the Promoter Program →"}
                </Link>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════
              RIGHT LOGIN PANEL
          ══════════════════════════════════════ */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "clamp(24px,4vh,52px) clamp(16px,3vw,44px)",
            background: "linear-gradient(160deg, #07080b 0%, #060709 100%)",
            position: "relative",
          }}>
            {/* Dot grid */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }} />
            {/* Gold vignette glow */}
            <div style={{
              position: "absolute", bottom: -120, right: -80, width: 400, height: 400,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 65%)",
              pointerEvents: "none",
            }} />

            <div className="lf-enter-4 w-full" style={{ maxWidth: 400, position: "relative" }}>
              {/* Gold top accent line */}
              <div style={{
                height: 2, borderRadius: "2px 2px 0 0",
                background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.7) 40%, rgba(255,236,140,1) 50%, rgba(212,175,55,0.7) 60%, transparent 100%)",
              }} />

              <Card className="w-full" style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderTop: "none",
                borderRadius: "0 0 18px 18px",
                boxShadow: "0 32px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
                backdropFilter: "blur(20px)",
              }}>
                <CardHeader style={{ paddingBottom: 0, paddingTop: 30 }}>
                  <p style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700,
                    letterSpacing: "0.32em", textTransform: "uppercase",
                    color: "rgba(212,175,55,0.55)", marginBottom: 8,
                  }}>
                    {t.login_eyebrow}
                  </p>
                  <CardTitle style={{
                    fontFamily: "var(--font-display)", fontSize: "1.625rem",
                    fontWeight: 800, color: "#fff", letterSpacing: "-0.025em",
                  }}>
                    {t.login_title}
                  </CardTitle>
                </CardHeader>

                <CardContent style={{ paddingTop: 26 }}>
                  <form style={{ display: "flex", flexDirection: "column", gap: 18 }} onSubmit={form.handleSubmit(onSubmit)}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{
                        fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: "rgba(255,255,255,0.38)",
                      }} htmlFor="identifier">
                        {t.email_or_username}
                      </label>
                      <Input
                        id="identifier" type="text" autoComplete="username"
                        className="lf-input"
                        {...form.register("identifier")}
                      />
                      {form.formState.errors.identifier?.message && (
                        <p style={{ fontSize: "0.8125rem", color: "#f87171" }}>{form.formState.errors.identifier.message}</p>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <label style={{
                          fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em",
                          textTransform: "uppercase", color: "rgba(255,255,255,0.38)",
                        }} htmlFor="password">
                          {t.password}
                        </label>
                        <Link
                          href="/forgot-password"
                          style={{ fontSize: "0.6875rem", color: "rgba(212,175,55,0.45)", textDecoration: "none" }}
                          className="hover:text-[var(--gold)]"
                        >
                          {t.forgot_password}
                        </Link>
                      </div>
                      <Input
                        id="password" type="password" autoComplete="current-password"
                        className="lf-input"
                        {...form.register("password")}
                      />
                      {form.formState.errors.password?.message && (
                        <p style={{ fontSize: "0.8125rem", color: "#f87171" }}>{form.formState.errors.password.message}</p>
                      )}
                    </div>

                    {errorMessage && (
                      <div style={{
                        padding: "10px 14px", borderRadius: 9,
                        background: "rgba(248,113,113,0.07)",
                        border: "1px solid rgba(248,113,113,0.22)",
                      }}>
                        <p style={{ fontSize: "0.8125rem", color: "#f87171" }}>{errorMessage}</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={form.formState.isSubmitting}
                      className="w-full lf-submit"
                      style={{ marginTop: 4 }}
                    >
                      {form.formState.isSubmitting ? t.signing_in : t.sign_in}
                    </Button>

                    <p style={{ textAlign: "center", fontSize: "0.875rem", color: "rgba(255,255,255,0.32)" }}>
                      {t.no_account}{" "}
                      <Link
                        href="/signup"
                        style={{ fontWeight: 700, color: "rgba(212,175,55,0.8)", textDecoration: "none" }}
                        className="hover:text-[var(--gold)]"
                      >
                        {t.create_account_link} →
                      </Link>
                    </p>
                  </form>

                  {/* Desktop WC teaser */}
                  <div className="hidden lg:block" style={{ marginTop: 24 }}>
                    <div style={{
                      borderRadius: 10, padding: "11px 16px",
                      border: "1px solid rgba(255,255,255,0.05)",
                      background: "rgba(255,255,255,0.02)",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⚽</span>
                      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.28)", lineHeight: 1.5 }}>
                        {isZh
                          ? "今天就开始：预测 2026 世界杯全部 72 场比赛"
                          : "72 matches live now — predict every 2026 World Cup result."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
