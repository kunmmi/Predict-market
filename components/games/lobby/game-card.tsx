"use client";

import Link from "next/link";

interface Game {
  href: string;
  name: string;
  description: string;
  houseEdge: string;
  tag: string;
}

// ---------------------------------------------------------------------------
// SVG icons — one per game
// ---------------------------------------------------------------------------

function IconCraps() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* back die */}
      <rect x="17" y="17" width="31" height="31" rx="6" fill="var(--bg-elevated)" stroke="var(--gold)" strokeWidth="1.5"/>
      <circle cx="25" cy="25" r="2.2" fill="var(--gold)" opacity="0.6"/>
      <circle cx="40" cy="25" r="2.2" fill="var(--gold)" opacity="0.6"/>
      <circle cx="32.5" cy="32.5" r="2.2" fill="var(--gold)" opacity="0.6"/>
      <circle cx="25" cy="40" r="2.2" fill="var(--gold)" opacity="0.6"/>
      <circle cx="40" cy="40" r="2.2" fill="var(--gold)" opacity="0.6"/>
      {/* front die */}
      <rect x="4" y="4" width="31" height="31" rx="6" fill="var(--bg-card)" stroke="var(--gold)" strokeWidth="1.5"/>
      <circle cx="12.5" cy="12.5" r="2.4" fill="var(--gold)"/>
      <circle cx="19.5" cy="19.5" r="2.4" fill="var(--gold)"/>
      <circle cx="26.5" cy="26.5" r="2.4" fill="var(--gold)"/>
    </svg>
  );
}

function IconCrash() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* trajectory curve */}
      <path d="M 4 46 C 12 42 24 28 38 10" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      {/* area fill under curve */}
      <path d="M 4 46 C 12 42 24 28 38 10 L 38 46 Z" fill="var(--teal)" opacity="0.08"/>
      {/* rocket body */}
      <path d="M 38 10 L 34 18 L 38 16 L 42 18 Z" fill="var(--gold)"/>
      <path d="M 38 4 L 34 10 L 42 10 Z" fill="var(--gold)"/>
      {/* crash X */}
      <line x1="44" y1="6" x2="50" y2="12" stroke="var(--rose)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="50" y1="6" x2="44" y2="12" stroke="var(--rose)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconRoulette() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* outer ring */}
      <circle cx="26" cy="26" r="22" stroke="var(--gold)" strokeWidth="1.5"/>
      {/* wheel segments — alternating red/black */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const nextAngle = ((i + 1) * 30 - 90) * (Math.PI / 180);
        const r1 = 10, r2 = 21;
        const x1 = 26 + r2 * Math.cos(angle),    y1 = 26 + r2 * Math.sin(angle);
        const x2 = 26 + r2 * Math.cos(nextAngle), y2 = 26 + r2 * Math.sin(nextAngle);
        const x3 = 26 + r1 * Math.cos(nextAngle), y3 = 26 + r1 * Math.sin(nextAngle);
        const x4 = 26 + r1 * Math.cos(angle),     y4 = 26 + r1 * Math.sin(angle);
        const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r2} ${r2} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${r1} ${r1} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
        const fill = i === 0 ? "#22c55e" : i % 2 === 0 ? "rgba(255,255,255,0.12)" : "rgba(180,30,30,0.55)";
        return <path key={i} d={d} fill={fill} stroke="var(--bg-base)" strokeWidth="0.5"/>;
      })}
      {/* inner hub */}
      <circle cx="26" cy="26" r="9" fill="var(--bg-elevated)" stroke="var(--gold)" strokeWidth="1.5"/>
      <circle cx="26" cy="26" r="3" fill="var(--gold)"/>
      {/* ball */}
      <circle cx="26" cy="6" r="2.5" fill="white"/>
    </svg>
  );
}

function IconMines() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 3×3 grid of tiles */}
      {[0,1,2].map(row =>
        [0,1,2].map(col => {
          const x = 4 + col * 15, y = 4 + row * 15;
          const isGem = (row === 0 && col === 0) || (row === 1 && col === 2) || (row === 2 && col === 1);
          const isMine = row === 1 && col === 1;
          return (
            <g key={`${row}-${col}`}>
              <rect x={x} y={y} width="13" height="13" rx="2.5"
                fill={isGem ? "rgba(13,184,145,0.15)" : isMine ? "rgba(239,68,68,0.12)" : "var(--bg-elevated)"}
                stroke={isGem ? "var(--teal)" : isMine ? "var(--rose)" : "var(--border-dim)"}
                strokeWidth="1"/>
              {isGem && (
                <path
                  d={`M ${x+6.5} ${y+2.5} L ${x+10} ${y+6} L ${x+6.5} ${y+10.5} L ${x+3} ${y+6} Z`}
                  fill="var(--teal)" opacity="0.9"/>
              )}
              {isMine && (
                <>
                  <circle cx={x+6.5} cy={y+6.5} r="2.5" fill="var(--rose)" opacity="0.8"/>
                  <line x1={x+6.5} y1={y+2} x2={x+6.5} y2={y+11} stroke="var(--rose)" strokeWidth="1" opacity="0.5"/>
                  <line x1={x+2} y1={y+6.5} x2={x+11} y2={y+6.5} stroke="var(--rose)" strokeWidth="1" opacity="0.5"/>
                </>
              )}
            </g>
          );
        })
      )}
      {/* large gem tile at bottom right */}
      <rect x="36" y="36" width="13" height="13" rx="2.5" fill="rgba(232,160,32,0.15)" stroke="var(--gold)" strokeWidth="1.2"/>
      <path d="M 42.5 38.5 L 46 42 L 42.5 47 L 39 42 Z" fill="var(--gold)" opacity="0.9"/>
    </svg>
  );
}

function IconDice() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* number line */}
      <rect x="4" y="23" width="44" height="6" rx="3" fill="var(--bg-elevated)" stroke="var(--border-dim)" strokeWidth="1"/>
      {/* green zone (over) */}
      <rect x="28" y="23" width="20" height="6" rx="3" fill="var(--teal)" opacity="0.25"/>
      {/* red zone (under) */}
      <rect x="4" y="23" width="24" height="6" rx="3" fill="var(--rose)" opacity="0.18"/>
      {/* tick marks */}
      {[14, 26, 38].map(x => (
        <line key={x} x1={x} y1={21} x2={x} y2={31} stroke="var(--border-subtle)" strokeWidth="1"/>
      ))}
      {/* thumb / slider */}
      <rect x="24" y="18" width="4" height="16" rx="2" fill="var(--gold)"/>
      <circle cx="26" cy="26" r="6" fill="var(--bg-card)" stroke="var(--gold)" strokeWidth="2"/>
      <text x="26" y="30" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--gold)" fontFamily="monospace">50</text>
      {/* labels */}
      <text x="8" y="43" fontSize="7" fill="var(--rose)" fontFamily="monospace" fontWeight="600">UNDER</text>
      <text x="30" y="43" fontSize="7" fill="var(--teal)" fontFamily="monospace" fontWeight="600">OVER</text>
    </svg>
  );
}

function IconPlinko() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* peg grid — 4 rows */}
      {[
        [26],
        [20, 32],
        [14, 26, 38],
        [8, 20, 32, 44],
      ].map((row, ri) =>
        row.map((cx, ci) => (
          <circle key={`${ri}-${ci}`} cx={cx} cy={8 + ri * 11} r="2.8"
            fill={ri === 3 && ci === 1 ? "var(--gold)" : "var(--border-subtle)"}
            stroke={ri === 3 && ci === 1 ? "var(--gold)" : "var(--border-dim)"}
            strokeWidth="0.5"/>
        ))
      )}
      {/* ball path */}
      <path d="M 26 2 L 26 8 L 20 19 L 26 30 L 20 41" stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" fill="none"/>
      {/* ball */}
      <circle cx="20" cy="41" r="5" fill="var(--gold)"/>
      {/* multiplier slots at bottom */}
      {[4, 14, 24, 34, 44].map((x, i) => (
        <rect key={i} x={x} y={47} width="8" height="4" rx="1"
          fill={i === 1 ? "rgba(232,160,32,0.4)" : "var(--bg-elevated)"}
          stroke={i === 1 ? "var(--gold)" : "var(--border-dim)"} strokeWidth="0.5"/>
      ))}
    </svg>
  );
}

const ICONS: Record<string, () => JSX.Element> = {
  "/games/craps":    IconCraps,
  "/games/crash":    IconCrash,
  "/games/roulette": IconRoulette,
  "/games/mines":    IconMines,
  "/games/dice":     IconDice,
  "/games/plinko":   IconPlinko,
};

// ---------------------------------------------------------------------------
// Lobby grid
// ---------------------------------------------------------------------------

export function GameLobby({ games }: { games: Game[] }) {
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {games.map((game) => {
        const Icon = ICONS[game.href];
        return (
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
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, flexShrink: 0 }}>
                  {Icon ? <Icon /> : null}
                </div>
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
        );
      })}
    </div>
  );
}
