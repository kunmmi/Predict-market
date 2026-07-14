export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/require-user";
import { GameLobby } from "@/components/games/lobby/game-card";

const GAMES = [
  {
    href: "/games/craps",
    name: "Craps",
    description: "Classic dice game. Bet Pass Line, Don't Pass, or Field. Pays 1:1.",
    emoji: "🎲",
    houseEdge: "~1.4%",
    tag: "Strategy",
    animationClass: "game-emoji-dice",
  },
  {
    href: "/games/crash",
    name: "Crash",
    description: "Set your target multiplier and watch the rocket fly. Cash out before it crashes.",
    emoji: "🚀",
    houseEdge: "~2%",
    tag: "High Risk",
    animationClass: "game-emoji-rocket",
  },
  {
    href: "/games/roulette",
    name: "Roulette",
    description: "European single-zero wheel. Outside bets, dozens, or straight up on any number for 35:1.",
    emoji: "🎰",
    houseEdge: "~2.7%",
    tag: "Classic",
    animationClass: "game-emoji-wheel",
  },
  {
    href: "/games/mines",
    name: "Mines",
    description: "Reveal gems in a 5×5 grid and avoid hidden mines. Cash out any time — more mines means bigger multipliers.",
    emoji: "💎",
    houseEdge: "~2%",
    tag: "Popular",
    animationClass: "game-emoji-gem",
  },
  {
    href: "/games/dice",
    name: "Dice",
    description: "Roll 0–99 and bet over or under your target. Drag the slider to set your own odds and multiplier.",
    emoji: "🎯",
    houseEdge: "~1%",
    tag: "Fast",
    animationClass: "game-emoji-target",
  },
  {
    href: "/games/plinko",
    name: "Plinko",
    description: "Drop a ball through 16 rows of pegs. It bounces randomly to a multiplier slot — up to 1000× on high risk.",
    emoji: "🔴",
    houseEdge: "~2%",
    tag: "Viral",
    animationClass: "game-emoji-ball",
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
      <GameLobby games={GAMES} />
    </div>
  );
}
