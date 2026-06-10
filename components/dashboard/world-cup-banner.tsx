"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function WorldCupBanner() {
  return (
    <Link href="/markets" style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
          padding: "2rem 2rem",
          background:
            "linear-gradient(135deg, #062010 0%, #0b3318 30%, #0f4520 55%, #0b3318 80%, #062010 100%)",
          border: "1px solid rgba(34,197,94,0.3)",
          boxShadow:
            "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,197,94,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
          cursor: "pointer",
          transition: "transform 200ms ease, box-shadow 200ms ease",
        }}
        className="group hover:-translate-y-0.5 hover:shadow-[0_12px_56px_rgba(0,0,0,0.7),0_0_0_1px_rgba(34,197,94,0.35),0_0_40px_rgba(34,197,94,0.06)]"
      >
        {/* Grass stripes */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 34px, rgba(255,255,255,0.022) 34px, rgba(255,255,255,0.022) 36px)",
            pointerEvents: "none",
          }}
        />

        {/* Top green glow edge */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent 0%, rgba(34,197,94,0.6) 30%, rgba(34,197,94,0.9) 50%, rgba(34,197,94,0.6) 70%, transparent 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Right ambient glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-30%", right: "-5%",
            width: "45%", height: "140%",
            background: "radial-gradient(ellipse, rgba(34,197,94,0.1) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        {/* Large faint background text */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: "-0.5rem",
            top: "50%",
            transform: "translateY(-50%)",
            fontFamily: "var(--font-mono)",
            fontSize: "7rem",
            fontWeight: 900,
            lineHeight: 1,
            color: "rgba(34,197,94,0.05)",
            letterSpacing: "-0.04em",
            userSelect: "none",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          2026
        </div>

        {/* Ball emoji floating bg */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: "10rem",
            top: "50%",
            transform: "translateY(-60%)",
            fontSize: "6rem",
            lineHeight: 1,
            opacity: 0.07,
            userSelect: "none",
            pointerEvents: "none",
            filter: "blur(2px)",
          }}
        >
          ⚽
        </div>

        {/* Main content */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Top row: badge + flags */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "var(--font-mono)",
                fontSize: "0.5625rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#4ade80",
                backgroundColor: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 100,
                padding: "3px 10px",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "#4ade80",
                  boxShadow: "0 0 8px #4ade80",
                  animation: "pulseDot 1.5s ease-in-out infinite",
                  display: "inline-block",
                }}
              />
              Now Live · Featured Event
            </span>

            <span style={{ fontSize: "1rem", userSelect: "none" }}>🇺🇸🇨🇦🇲🇽</span>
          </div>

          {/* Middle row: headline + CTA */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(1.375rem, 4vw, 1.875rem)",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.1,
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                FIFA World Cup 2026™
              </h2>
              <p
                style={{
                  marginTop: 6,
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8125rem",
                  color: "rgba(255,255,255,0.5)",
                  lineHeight: 1.5,
                }}
              >
                48 nations. 104 matches. One champion.
                <br />
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" }}>
                  June 11 – July 19, 2026 &nbsp;·&nbsp; USA, Canada & Mexico
                </span>
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
              {/* Market count pill */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.5625rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                  backgroundColor: "rgba(232,160,32,0.1)",
                  border: "1px solid rgba(232,160,32,0.2)",
                  borderRadius: 100,
                  padding: "3px 10px",
                }}
              >
                39 markets open
              </span>

              {/* CTA button */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 22px",
                  borderRadius: "var(--radius-sm)",
                  background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "#fff",
                  boxShadow: "0 0 24px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                  transition: "opacity 150ms ease, box-shadow 150ms ease",
                }}
                className="group-hover:opacity-95 group-hover:shadow-[0_0_32px_rgba(34,197,94,0.5)]"
              >
                Start Predicting
                <ArrowRight style={{ width: 15, height: 15 }} />
              </div>
            </div>
          </div>

          {/* Bottom row: stat chips */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              paddingTop: 4,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {[
              { emoji: "🏆", label: "Tournament Winner" },
              { emoji: "⚽", label: "Group Stage Matches" },
              { emoji: "📊", label: "Yes / No Markets" },
              { emoji: "🔓", label: "Open Now" },
            ].map(({ emoji, label }) => (
              <span
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.6875rem",
                  color: "rgba(255,255,255,0.45)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 100,
                  padding: "3px 10px",
                }}
              >
                <span style={{ fontSize: "0.75rem" }}>{emoji}</span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
