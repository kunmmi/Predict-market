import Link from "next/link";
import { ArrowRight, Zap, Shield, Clock } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getPublicActiveMarkets } from "@/lib/services/market-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { HomeNav } from "@/components/layout/home-nav";
import { MarketCarousel } from "@/components/ui/market-carousel";
import { HomeWorldCupBanner } from "@/components/home/world-cup-home-banner";

export default async function Home() {
  const { user } = await getCurrentUser();
  const markets = await getPublicActiveMarkets();
  const locale = getLocale();
  const t = getT(locale);
  const tl = t.landing;
  const tn = t.nav;

  const NAV_LINKS = [
    { label: tn.markets,   href: "/markets" },
    { label: tn.portfolio, href: "/portfolio" },
    { label: tn.promoter,  href: "/promoter" },
  ];

  const FEATURES = [
    {
      icon: Zap,
      title: locale === "zh" ? "闪电快速" : "Lightning Fast",
      desc: locale === "zh" ? "5分钟、15分钟轮次" : "5-min & 15-min rounds",
    },
    {
      icon: Shield,
      title: locale === "zh" ? "即时结算" : "Instant Settlement",
      desc: locale === "zh" ? "自动链上结算" : "On-chain auto-settlement",
    },
    {
      icon: Clock,
      title: locale === "zh" ? "全天候交易" : "24/7 Markets",
      desc: locale === "zh" ? "全天候实时行情" : "Live prices around the clock",
    },
  ];

  return (
    <main
      style={{ backgroundColor: "var(--bg-void)", color: "var(--text-primary)", minHeight: "100vh" }}
    >
      {/* ── Grain overlay ────────────────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: 0.025,
        }}
      />

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <HomeNav
        locale={locale}
        user={!!user}
        navLinks={NAV_LINKS}
        labels={{ login: tn.login, register: tn.register, dashboard: tn.dashboard }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Grid background */}
        <div
          aria-hidden
          className="bg-grid absolute inset-0"
          style={{ opacity: 0.6 }}
        />

        {/* Ambient glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "60vw",
            height: "40vh",
            background: "radial-gradient(ellipse, rgba(232,160,32,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "60%",
            right: "-10%",
            width: "40vw",
            height: "40vh",
            background: "radial-gradient(ellipse, rgba(16,207,160,0.04) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pt-8 pb-12 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:pt-14 lg:pb-20">
          {/* Left: Copy */}
          <div>
            <div className="animate-fade-up">
              <span className="tag-live">
                {markets.length} {markets.length === 1 ? tl.active_markets_singular : tl.active_markets_plural}
              </span>
            </div>

            <h1
              className="animate-fade-up stagger-1"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.25rem, 4.5vw, 3.75rem)",
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                marginTop: "1rem",
              }}
            >
              {tl.hero_title_1}
              <br />
              <span style={{ color: "var(--gold)" }}>{tl.hero_title_2}</span>
            </h1>

            <p
              className="animate-fade-up stagger-2"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(0.9375rem, 2vw, 1.125rem)",
                lineHeight: 1.65,
                color: "var(--text-secondary)",
                maxWidth: "440px",
                marginTop: "1rem",
                fontWeight: 300,
              }}
            >
              {tl.hero_sub}
            </p>

            <div className="animate-fade-up stagger-3 mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={user ? "/markets" : "/signup"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "#070809",
                  padding: "13px 28px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
                  textDecoration: "none",
                  boxShadow: "0 0 30px rgba(232,160,32,0.2)",
                  transition: "opacity 150ms ease, box-shadow 200ms ease",
                }}
                className="hover:opacity-90 hover:shadow-[0_0_40px_rgba(232,160,32,0.35)]"
              >
                {user ? tl.cta_browse : tl.cta_start}
                <ArrowRight style={{ width: 16, height: 16 }} />
              </Link>

              {!user && (
                <Link
                  href="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    padding: "13px 28px",
                    borderRadius: 10,
                    border: "1px solid var(--border-strong)",
                    textDecoration: "none",
                    transition: "color 150ms ease, border-color 150ms ease",
                    backgroundColor: "var(--bg-surface)",
                  }}
                  className="hover:text-white hover:border-[--border-gold]"
                >
                  {tl.cta_login}
                </Link>
              )}
            </div>

            {/* Stats row */}
            <div
              className="animate-fade-up stagger-4 mt-12 flex flex-wrap items-center gap-6"
              style={{ borderTop: "1px solid var(--border-dim)", paddingTop: "1.5rem" }}
            >
              {[tl.stat_trade, tl.stat_settlement].map((stat, i) => (
                <p key={i} style={{ fontSize: "0.8125rem", color: "var(--text-dim)", fontWeight: 400 }}>
                  {stat}
                </p>
              ))}
            </div>
          </div>

          {/* Right: Carousel — self-start so it anchors to top of the grid row */}
          <div className="animate-fade-up stagger-2 relative lg:self-start">
            {/* Outer glow ring */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: "-1px",
                borderRadius: "var(--radius-xl)",
                background: "linear-gradient(135deg, var(--border-gold) 0%, transparent 50%, rgba(16,207,160,0.15) 100%)",
                padding: "1px",
              }}
            />
            <div
              style={{
                position: "relative",
                borderRadius: "var(--radius-xl)",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                padding: "1rem",
                boxShadow: "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px var(--border-dim)",
              }}
            >
              <MarketCarousel markets={markets} isLoggedIn={!!user} locale={locale} tCarousel={t.carousel} />
            </div>
          </div>
        </div>

        {/* Feature strip */}
        <div
          style={{
            borderTop: "1px solid var(--border-dim)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <div className="grid gap-6 sm:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div
                    style={{
                      width: 36, height: 36,
                      borderRadius: 8,
                      backgroundColor: "var(--gold-dim)",
                      border: "1px solid var(--border-gold)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon style={{ width: 16, height: 16, color: "var(--gold)" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── World Cup featured event ──────────────────────────────────────── */}
      <HomeWorldCupBanner isLoggedIn={!!user} />
    </main>
  );
}
