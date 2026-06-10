"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

export function WorldCupBanner() {
  return (
    <Link href="/markets" style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
          padding: "1.5rem 1.75rem",
          background:
            "linear-gradient(135deg, #0d4a1f 0%, #0a3d18 35%, #072e10 65%, #0a3d18 100%)",
          border: "1px solid rgba(34,197,94,0.25)",
          boxShadow:
            "0 4px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.12), inset 0 1px 0 rgba(255,255,255,0.04)",
          cursor: "pointer",
          transition: "transform 200ms ease, box-shadow 200ms ease",
        }}
        className="group hover:-translate-y-0.5 hover:shadow-[0_8px_48px_rgba(0,0,0,0.6),0_0_0_1px_rgba(34,197,94,0.3)]"
      >
        {/* Grass texture lines */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(255,255,255,0.025) 28px, rgba(255,255,255,0.025) 30px)",
            pointerEvents: "none",
          }}
        />

        {/* Ambient glow top-right */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-30%",
            right: "-5%",
            width: "40%",
            height: "120%",
            background:
              "radial-gradient(ellipse, rgba(34,197,94,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Large faint trophy bg */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: "1.5rem",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "5rem",
            lineHeight: 1,
            opacity: 0.08,
            userSelect: "none",
            pointerEvents: "none",
            filter: "blur(1px)",
          }}
        >
          🏆
        </div>

        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          {/* Left content */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Trophy icon */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
                borderRadius: "var(--radius-md)",
                background: "linear-gradient(135deg, rgba(232,160,32,0.25) 0%, rgba(232,160,32,0.1) 100%)",
                border: "1px solid rgba(232,160,32,0.3)",
                flexShrink: 0,
              }}
            >
              <Trophy style={{ width: 24, height: 24, color: "var(--gold)" }} />
            </div>

            <div>
              {/* Live badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.5625rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#4ade80",
                    backgroundColor: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 100,
                    padding: "2px 8px",
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      backgroundColor: "#4ade80",
                      boxShadow: "0 0 6px #4ade80",
                      animation: "pulseDot 1.5s ease-in-out infinite",
                    }}
                  />
                  Featured Event
                </span>
              </div>

              <h2
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "1.1875rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.1,
                  margin: 0,
                }}
              >
                FIFA World Cup 2026™
              </h2>
              <p
                style={{
                  marginTop: 3,
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.5)",
                  lineHeight: 1.4,
                }}
              >
                USA · Canada · Mexico &nbsp;·&nbsp; Jun 11 – Jul 19 &nbsp;·&nbsp; 48 Teams
              </p>
            </div>
          </div>

          {/* Right CTA */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: "var(--radius-sm)",
              background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
              fontFamily: "var(--font-sans)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "#070809",
              boxShadow: "0 0 20px rgba(232,160,32,0.3)",
              flexShrink: 0,
              transition: "opacity 150ms ease",
            }}
            className="group-hover:opacity-90"
          >
            Predict Now
            <ArrowRight style={{ width: 14, height: 14 }} />
          </div>
        </div>
      </div>
    </Link>
  );
}
