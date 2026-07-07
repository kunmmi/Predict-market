export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/require-user";
import Link from "next/link";

const GAMES = [
  {
    href: "/games/craps",
    name: "Craps",
    description: "Classic dice game. Bet Pass Line, Don't Pass, or Field. Pays 1:1.",
    emoji: "🎲",
    houseEdge: "~1.4%",
    tag: "Strategy",
  },
  {
    href: "/games/crash",
    name: "Crash",
    description: "Set your target multiplier and watch the rocket fly. Cash out before it crashes.",
    emoji: "🚀",
    houseEdge: "~2%",
    tag: "High Risk",
  },
  {
    href: "/games/roulette",
    name: "Roulette",
    description: "European single-zero wheel. Outside bets, dozens, or straight up on any number for 35:1.",
    emoji: "🎰",
    houseEdge: "~2.7%",
    tag: "Classic",
  },
];

export default async function GamesPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
            marginBottom: 4,
          }}
        >
          Games
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Play with your USDT balance. All games have demo mode — no spend required to try.
        </p>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {GAMES.map((game) => (
          <Link
            key={game.href}
            href={game.href}
            style={{ textDecoration: "none" }}
          >
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
                <span style={{ fontSize: "2.5rem", lineHeight: 1 }}>{game.emoji}</span>
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
                <span
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "var(--gold)",
                  }}
                >
                  Play →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
