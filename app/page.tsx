import Link from "next/link";
import { ArrowRight, Zap, Shield, TrendingUp } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getPublicActiveMarkets } from "@/lib/services/market-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { HomeNav } from "@/components/layout/home-nav";
import { MarketCarousel } from "@/components/ui/market-carousel";

export default async function Home() {
  const { user } = await getCurrentUser();
  const markets = await getPublicActiveMarkets();
  const locale = getLocale();
  const t = getT(locale);
  const tl = t.landing;
  const twc = t.world_cup;
  const tn = t.nav;

  const NAV_LINKS = [
    { label: tn.markets,   href: "/markets" },
    { label: tn.portfolio, href: "/portfolio" },
    { label: tn.promoter,  href: "/promoter" },
  ];

  // Separate World Cup from crypto markets for display
  const cryptoMarkets = markets.filter((m) => m.assetSymbol !== "FIFA");
  const worldCupCount = markets.filter((m) => m.assetSymbol === "FIFA").length;

  const ctaHref  = user ? "/markets" : "/signup";
  const ctaLabel = user ? tl.cta_browse : tl.cta_start;
  const wcHref   = user ? "/markets" : "/signup";

  return (
    <main style={{ backgroundColor: "var(--bg-void)", color: "var(--text-primary)", minHeight: "100vh" }}>

      {/* ── Grain overlay ── */}
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: 0.025,
        }}
      />

      {/* ── Navigation ── */}
      <HomeNav
        locale={locale}
        user={!!user}
        navLinks={NAV_LINKS}
        labels={{ login: tn.login, register: tn.register, dashboard: tn.dashboard }}
      />

      {/* ══════════════════════════════════════════════════════════════════
          HERO — platform pitch (left) + World Cup event card (right)
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        {/* Grid background */}
        <div aria-hidden className="bg-grid absolute inset-0" style={{ opacity: 0.5 }} />

        {/* Gold ambient glow — left */}
        <div
          aria-hidden
          style={{
            position: "absolute", top: "10%", left: "0%",
            width: "50vw", height: "60vh",
            background: "radial-gradient(ellipse, rgba(232,160,32,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        {/* Green ambient glow — right */}
        <div
          aria-hidden
          style={{
            position: "absolute", top: "0%", right: "-5%",
            width: "45vw", height: "80vh",
            background: "radial-gradient(ellipse, rgba(34,197,94,0.07) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">

            {/* ── LEFT: Platform pitch ── */}
            <div className="animate-fade-up flex flex-col gap-6">

              {/* Active markets badge */}
              <div>
                <span className="tag-live">
                  {markets.length} {markets.length === 1 ? tl.active_markets_singular : tl.active_markets_plural}
                </span>
              </div>

              {/* Headline */}
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)",
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                }}
              >
                {tl.hero_title_1}
                <br />
                <span style={{ color: "var(--gold)" }}>{tl.hero_title_2}</span>
              </h1>

              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(0.9375rem, 2vw, 1.125rem)",
                  lineHeight: 1.65,
                  color: "var(--text-secondary)",
                  maxWidth: "420px",
                  fontWeight: 300,
                }}
              >
                {tl.hero_sub}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={ctaHref}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 600,
                    color: "#070809", padding: "13px 28px", borderRadius: 10,
                    background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                    textDecoration: "none",
                    boxShadow: "0 0 28px rgba(232,160,32,0.2)",
                    transition: "opacity 150ms ease, box-shadow 200ms ease",
                  }}
                  className="hover:opacity-90 hover:shadow-[0_0_40px_rgba(232,160,32,0.35)]"
                >
                  {ctaLabel}
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </Link>

                {!user && (
                  <Link
                    href="/login"
                    style={{
                      display: "inline-flex", alignItems: "center",
                      fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 500,
                      color: "var(--text-secondary)", padding: "13px 28px", borderRadius: 10,
                      border: "1px solid var(--border-strong)", textDecoration: "none",
                      backgroundColor: "var(--bg-surface)",
                      transition: "color 150ms ease, border-color 150ms ease",
                    }}
                    className="hover:text-white hover:border-[--border-gold]"
                  >
                    {tl.cta_login}
                  </Link>
                )}
              </div>

              {/* Stats strip */}
              <div
                style={{
                  display: "flex", flexWrap: "wrap", gap: "1.5rem",
                  borderTop: "1px solid var(--border-dim)", paddingTop: "1.25rem",
                }}
              >
                {[tl.stat_trade, tl.stat_settlement].map((stat, i) => (
                  <p key={i} style={{ fontSize: "0.8125rem", color: "var(--text-dim)", fontWeight: 400 }}>
                    {stat}
                  </p>
                ))}
              </div>
            </div>

            {/* ── RIGHT: World Cup featured event card ── */}
            <div className="animate-fade-up stagger-2 relative">
              <Link href={wcHref} style={{ textDecoration: "none", display: "block" }}>
                <div
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: "var(--radius-xl)",
                    background: "linear-gradient(160deg, #062010 0%, #0b3318 30%, #103d1e 55%, #0b3318 80%, #062010 100%)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    boxShadow: "0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,197,94,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
                    padding: "2rem",
                    minHeight: 380,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    transition: "transform 220ms ease, box-shadow 220ms ease",
                  }}
                  className="group hover:-translate-y-1 hover:shadow-[0_16px_64px_rgba(0,0,0,0.7),0_0_0_1px_rgba(34,197,94,0.4),0_0_60px_rgba(34,197,94,0.08)]"
                >
                  {/* Grass stripe texture */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute", inset: 0,
                      backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 36px, rgba(255,255,255,0.02) 36px, rgba(255,255,255,0.02) 38px)",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Glowing top edge */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.6) 30%, rgba(34,197,94,1) 50%, rgba(34,197,94,0.6) 70%, transparent)",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Ambient right glow */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute", top: "-20%", right: "-10%",
                      width: "60%", height: "120%",
                      background: "radial-gradient(ellipse, rgba(34,197,94,0.12) 0%, transparent 65%)",
                      pointerEvents: "none",
                    }}
                  />

                  {/* Large faded year */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute", right: "-0.25rem", bottom: "1rem",
                      fontFamily: "var(--font-mono)", fontSize: "8rem",
                      fontWeight: 900, lineHeight: 1,
                      color: "rgba(34,197,94,0.05)", letterSpacing: "-0.04em",
                      userSelect: "none", pointerEvents: "none",
                    }}
                  >
                    2026
                  </div>

                  {/* Top section: badge + ball */}
                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                          fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
                          color: "#4ade80",
                          backgroundColor: "rgba(34,197,94,0.12)",
                          border: "1px solid rgba(34,197,94,0.3)",
                          borderRadius: 100, padding: "4px 12px",
                        }}
                      >
                        <span
                          style={{
                            width: 6, height: 6, borderRadius: "50%",
                            backgroundColor: "#4ade80", boxShadow: "0 0 8px #4ade80",
                          }}
                        />
                        {twc.featured_badge}
                      </span>
                      <span style={{ fontSize: "1.5rem" }}>🏆</span>
                    </div>

                    {/* Main title */}
                    <div style={{ marginTop: "1.5rem" }}>
                      <p
                        style={{
                          fontFamily: "var(--font-mono)", fontSize: "0.625rem",
                          fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase",
                          color: "rgba(34,197,94,0.7)", marginBottom: 6,
                        }}
                      >
                        FIFA WORLD CUP
                      </p>
                      <h2
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "clamp(3rem, 6vw, 4.5rem)",
                          fontWeight: 900,
                          lineHeight: 0.95,
                          letterSpacing: "-0.03em",
                          margin: 0,
                          background: "linear-gradient(135deg, #86efac 0%, #4ade80 40%, #22c55e 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        2026™
                      </h2>
                    </div>

                    {/* Flags + location */}
                    <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "1rem" }}>🇺🇸🇨🇦🇲🇽</span>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                        {twc.host}
                      </span>
                    </div>
                  </div>

                  {/* Middle: stats */}
                  <div style={{ position: "relative", display: "flex", gap: "1.5rem", marginTop: "1.75rem" }}>
                    {[
                      { n: "48", label: twc.stat_nations },
                      { n: "104", label: twc.stat_matches },
                      { n: String(worldCupCount || 39), label: twc.stat_markets },
                    ].map(({ n, label }) => (
                      <div key={label}>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.5rem", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{n}</p>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 3 }}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Bottom: dates + CTA */}
                  <div style={{ position: "relative", marginTop: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
                      {twc.dates}
                    </p>

                    <div
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7,
                        padding: "10px 22px", borderRadius: "var(--radius-sm)",
                        background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                        fontFamily: "var(--font-sans)", fontSize: "0.875rem",
                        fontWeight: 700, color: "#fff",
                        boxShadow: "0 0 24px rgba(34,197,94,0.35)",
                        transition: "opacity 150ms ease",
                      }}
                      className="group-hover:opacity-90"
                    >
                      {twc.predict_now}
                      <ArrowRight style={{ width: 15, height: 15 }} />
                    </div>
                  </div>
                </div>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          CRYPTO MARKETS — live carousel
      ══════════════════════════════════════════════════════════════════ */}
      {cryptoMarkets.length > 0 && (
        <section
          style={{
            borderTop: "1px solid var(--border-dim)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: 8 }}>
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                    fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
                    color: "var(--text-dim)", marginBottom: 4,
                  }}
                >
                  {tl.also_live}
                </p>
                <h3
                  style={{
                    fontFamily: "var(--font-sans)", fontSize: "1.0625rem",
                    fontWeight: 700, color: "var(--text-primary)", margin: 0,
                  }}
                >
                  {tl.crypto_markets_title}
                </h3>
              </div>
              <Link
                href={user ? "/markets" : "/signup"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontFamily: "var(--font-sans)", fontSize: "0.8125rem",
                  fontWeight: 600, color: "var(--gold)", textDecoration: "none",
                  transition: "opacity 150ms ease",
                }}
                className="hover:opacity-70"
              >
                {tl.view_all} <ArrowRight style={{ width: 13, height: 13 }} />
              </Link>
            </div>

            <MarketCarousel
              markets={cryptoMarkets}
              isLoggedIn={!!user}
              locale={locale}
              tCarousel={t.carousel}
            />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FEATURES — how it works
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ borderTop: "1px solid var(--border-dim)" }}>
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <p
            style={{
              textAlign: "center",
              fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
              fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
              color: "var(--text-dim)", marginBottom: "0.625rem",
            }}
          >
            {tl.how_it_works_label}
          </p>
          <h3
            style={{
              textAlign: "center",
              fontFamily: "var(--font-sans)", fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
              fontWeight: 700, color: "var(--text-primary)",
              margin: "0 auto 2.5rem", maxWidth: 480,
            }}
          >
            {tl.how_it_works_title}
          </h3>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: TrendingUp,
                step: "01",
                title: tl.step1_title,
                desc: tl.step1_desc,
                color: "var(--gold)",
                bg: "rgba(232,160,32,0.08)",
                border: "rgba(232,160,32,0.2)",
              },
              {
                icon: Zap,
                step: "02",
                title: tl.step2_title,
                desc: tl.step2_desc,
                color: "var(--teal)",
                bg: "rgba(16,207,160,0.08)",
                border: "rgba(16,207,160,0.2)",
              },
              {
                icon: Shield,
                step: "03",
                title: tl.step3_title,
                desc: tl.step3_desc,
                color: "#4ade80",
                bg: "rgba(34,197,94,0.08)",
                border: "rgba(34,197,94,0.2)",
              },
            ].map(({ icon: Icon, step, title, desc, color, bg, border }) => (
              <div
                key={step}
                style={{
                  position: "relative",
                  padding: "1.75rem",
                  borderRadius: "var(--radius-lg)",
                  backgroundColor: "var(--bg-surface)",
                  border: `1px solid var(--border-subtle)`,
                  overflow: "hidden",
                }}
              >
                {/* Step number watermark */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute", top: "0.75rem", right: "1rem",
                    fontFamily: "var(--font-mono)", fontSize: "3.5rem",
                    fontWeight: 900, color: "rgba(255,255,255,0.03)",
                    lineHeight: 1, userSelect: "none", pointerEvents: "none",
                  }}
                >
                  {step}
                </div>

                <div
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: bg, border: `1px solid ${border}`,
                    marginBottom: "1rem",
                  }}
                >
                  <Icon style={{ width: 20, height: 20, color }} />
                </div>

                <p
                  style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                    fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    color, marginBottom: 6,
                  }}
                >
                  {tl.step_label} {step}
                </p>
                <h4
                  style={{
                    fontFamily: "var(--font-sans)", fontSize: "1rem",
                    fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px",
                  }}
                >
                  {title}
                </h4>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          BOTTOM CTA
      ══════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          borderTop: "1px solid var(--border-dim)",
          background: "linear-gradient(180deg, var(--bg-void) 0%, var(--bg-surface) 100%)",
        }}
      >
        <div
          className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20"
          style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
              fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
              color: "var(--gold)", backgroundColor: "var(--gold-dim)",
              border: "1px solid var(--border-gold)", borderRadius: 100,
              padding: "3px 12px",
            }}
          >
            {worldCupCount > 0
              ? tl.markets_open_wc.replace("{n}", String(worldCupCount))
              : tl.markets_open.replace("{n}", String(markets.length))
            }
          </span>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 700, lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)", margin: 0,
            }}
          >
            {tl.cta_ready}<br />
            <span style={{ color: "var(--gold)" }}>{tl.cta_prediction}</span>
          </h2>

          <p style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 400, margin: 0 }}>
            {tl.cta_sub}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 8 }}>
            <Link
              href={ctaHref}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontFamily: "var(--font-sans)", fontSize: "1rem", fontWeight: 600,
                color: "#070809", padding: "14px 32px", borderRadius: 10,
                background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                textDecoration: "none", boxShadow: "0 0 30px rgba(232,160,32,0.25)",
                transition: "opacity 150ms ease",
              }}
              className="hover:opacity-90"
            >
              {ctaLabel} <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
