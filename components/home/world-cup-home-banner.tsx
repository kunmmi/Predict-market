import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HomeWorldCupBanner({ isLoggedIn }: { isLoggedIn: boolean }) {
  const ctaHref = isLoggedIn ? "/markets" : "/signup";
  const ctaLabel = isLoggedIn ? "View World Cup Markets" : "Create Free Account";

  return (
    <section
      style={{
        borderTop: "1px solid rgba(34,197,94,0.15)",
        borderBottom: "1px solid rgba(34,197,94,0.1)",
        background:
          "linear-gradient(180deg, rgba(6,32,16,0.98) 0%, rgba(8,38,18,1) 50%, rgba(5,24,12,0.98) 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grass stripes */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent, transparent 38px, rgba(255,255,255,0.018) 38px, rgba(255,255,255,0.018) 40px)",
          pointerEvents: "none",
        }}
      />

      {/* Top green glow bar */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 3,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.5) 25%, rgba(34,197,94,1) 50%, rgba(34,197,94,0.5) 75%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Left ambient */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%", left: "-5%",
          transform: "translateY(-50%)",
          width: "35%", height: "200%",
          background: "radial-gradient(ellipse, rgba(34,197,94,0.07) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      {/* Right ambient */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%", right: "-5%",
          transform: "translateY(-50%)",
          width: "35%", height: "200%",
          background: "radial-gradient(ellipse, rgba(232,160,32,0.05) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      {/* Large watermark text */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: "var(--font-mono)",
          fontSize: "clamp(5rem, 18vw, 14rem)",
          fontWeight: 900,
          color: "rgba(34,197,94,0.04)",
          letterSpacing: "-0.04em",
          userSelect: "none",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        WORLD CUP
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1.5rem" }}>

          {/* Live badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-mono)",
                fontSize: "0.5625rem",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#4ade80",
                backgroundColor: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 100,
                padding: "4px 14px",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "#4ade80",
                  boxShadow: "0 0 10px #4ade80",
                  flexShrink: 0,
                }}
              />
              Now Live — Featured Event
            </span>
            <span style={{ fontSize: "1.25rem" }}>🇺🇸🇨🇦🇲🇽</span>
          </div>

          {/* Main headline */}
          <div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 5.5vw, 4rem)",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              FIFA World Cup
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                2026™
              </span>
            </h2>
            <p
              style={{
                marginTop: "0.875rem",
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(0.9375rem, 2vw, 1.125rem)",
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.6,
                maxWidth: 520,
                margin: "0.875rem auto 0",
              }}
            >
              48 nations. 104 matches. One champion.
              <br />
              Predict match outcomes and tournament winners — all markets open now.
            </p>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "1.5rem",
              padding: "1.25rem 2rem",
              borderRadius: "var(--radius-lg)",
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {[
              { value: "39", label: "Markets Open" },
              { value: "48", label: "Nations" },
              { value: "104", label: "Total Matches" },
              { value: "Jul 19", label: "Final Date" },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign: "center", minWidth: 72 }}>
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "#4ade80",
                    lineHeight: 1,
                  }}
                >
                  {value}
                </p>
                <p
                  style={{
                    marginTop: 4,
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.6875rem",
                    color: "rgba(255,255,255,0.35)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Market type chips */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {[
              "🏆 Tournament Winner",
              "⚽ Group Stage Matches",
              "🔄 Round 1 · Round 2 · Round 3",
              "📊 Yes / No Markets",
            ].map((chip) => (
              <span
                key={chip}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.5)",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 100,
                  padding: "5px 14px",
                }}
              >
                {chip}
              </span>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
            <Link
              href={ctaHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-sans)",
                fontSize: "1rem",
                fontWeight: 700,
                color: "#fff",
                padding: "13px 30px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                textDecoration: "none",
                boxShadow: "0 0 32px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
                transition: "opacity 150ms ease",
              }}
              className="hover:opacity-90"
            >
              {ctaLabel}
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>

            {!isLoggedIn && (
              <Link
                href="/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontFamily: "var(--font-sans)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.6)",
                  padding: "13px 28px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  textDecoration: "none",
                  transition: "color 150ms ease, border-color 150ms ease",
                }}
                className="hover:text-white hover:border-[rgba(34,197,94,0.4)]"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Footnote */}
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.6875rem",
              color: "rgba(255,255,255,0.2)",
            }}
          >
            June 11 – July 19, 2026 &nbsp;·&nbsp; USA, Canada &amp; Mexico
          </p>
        </div>
      </div>
    </section>
  );
}
