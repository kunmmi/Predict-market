"use client";

import Link from "next/link";

interface Game {
  href: string;
  name: string;
  description: string;
  emoji: string;
  houseEdge: string;
  tag: string;
  animationClass: string;
}

export function GameLobby({ games }: { games: Game[] }) {
  return (
    <>
      <style>{`
        @keyframes dice-roll {
          0%   { transform: rotate(0deg) scale(1); }
          20%  { transform: rotate(-15deg) scale(1.1); }
          40%  { transform: rotate(15deg) scale(1.05); }
          60%  { transform: rotate(-10deg) scale(1.1); }
          80%  { transform: rotate(8deg) scale(1.05); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes rocket-float {
          0%   { transform: translateY(0px) rotate(-5deg); }
          50%  { transform: translateY(-8px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(-5deg); }
        }
        @keyframes wheel-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes coin-flip {
          0%   { transform: scaleX(1); }
          50%  { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        .game-emoji-dice    { animation: dice-roll 2.4s ease-in-out infinite; display: inline-block; }
        .game-emoji-rocket  { animation: rocket-float 2s ease-in-out infinite; display: inline-block; }
        .game-emoji-wheel   { animation: wheel-spin 4s linear infinite; display: inline-block; }
        .game-emoji-coin    { animation: coin-flip 1.8s ease-in-out infinite; display: inline-block; }
        @keyframes gem-pulse {
          0%, 100% { transform: scale(1) rotate(-8deg); filter: brightness(1); }
          50%       { transform: scale(1.15) rotate(8deg); filter: brightness(1.4); }
        }
        .game-emoji-gem { animation: gem-pulse 2s ease-in-out infinite; display: inline-block; }
      `}</style>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {games.map((game) => (
          <Link key={game.href} href={game.href} style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: "24px",
                cursor: "pointer",
                transition: "border-color 150ms ease, box-shadow 150ms ease",
              }}
              className="hover:!border-[--border-gold] hover:!shadow-[0_0_20px_var(--gold-glow)]"
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <span className={game.animationClass} style={{ fontSize: "2.5rem", lineHeight: 1 }}>
                  {game.emoji}
                </span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--gold)",
                    background: "var(--gold-dim)",
                    border: "1px solid var(--border-gold)",
                    borderRadius: 4,
                    padding: "2px 8px",
                  }}
                >
                  {game.tag}
                </span>
              </div>

              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 6,
                }}
              >
                {game.name}
              </h2>

              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
                {game.description}
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  borderTop: "1px solid var(--border-dim)",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  House edge: <span style={{ color: "var(--text-secondary)" }}>{game.houseEdge}</span>
                </span>
                <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--gold)" }}>
                  Play →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
