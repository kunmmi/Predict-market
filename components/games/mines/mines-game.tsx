"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Multiplier formula: C(25,k) / C(25-mines,k)
// ---------------------------------------------------------------------------
function nCr(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  if (k === 0) return 1;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return r;
}

function calcMultiplier(revealed: number, mines: number): number {
  if (revealed === 0) return 1;
  return nCr(25, revealed) / nCr(25 - mines, revealed);
}

type Phase = "idle" | "active" | "cashed_out" | "exploded";
type TileState = "hidden" | "gem" | "mine" | "mine_hidden";

const MINE_PRESETS = [1, 3, 5, 10, 24];
const BET_PRESETS  = [1, 5, 25, 100];

// ---------------------------------------------------------------------------
// Demo mine generator (client-side only)
// ---------------------------------------------------------------------------
function generateMines(count: number): Set<number> {
  const positions = Array.from({ length: 25 }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return new Set(positions.slice(0, count));
}

// ---------------------------------------------------------------------------
// Single tile
// ---------------------------------------------------------------------------
function Tile({
  state,
  onClick,
  disabled,
  index,
}: {
  state: TileState;
  onClick: () => void;
  disabled: boolean;
  index: number;
}) {
  const isHidden  = state === "hidden";
  const isGem     = state === "gem";
  const isMine    = state === "mine";
  const isMineHid = state === "mine_hidden";

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || !isHidden}
      initial={false}
      animate={
        isGem  ? { scale: [1, 1.18, 1], backgroundColor: "rgba(20,120,60,0.85)" } :
        isMine ? { scale: [1, 1.25, 0.95, 1], backgroundColor: "rgba(140,10,10,0.9)" } :
        {}
      }
      whileHover={isHidden && !disabled ? { scale: 1.06, backgroundColor: "rgba(255,200,60,0.1)" } : {}}
      transition={{ duration: 0.25 }}
      style={{
        width: "100%",
        aspectRatio: "1",
        borderRadius: 8,
        border: isGem
          ? "1px solid #22c55e"
          : isMine
          ? "1px solid #ef4444"
          : isMineHid
          ? "1px solid rgba(239,68,68,0.3)"
          : "1px solid var(--border-subtle)",
        background: isGem
          ? "rgba(20,120,60,0.85)"
          : isMine
          ? "rgba(140,10,10,0.9)"
          : isMineHid
          ? "rgba(60,0,0,0.4)"
          : "var(--bg-elevated)",
        cursor: isHidden && !disabled ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "clamp(14px, 3vw, 22px)",
        transition: "border-color 120ms ease",
        padding: 0,
      }}
    >
      {isGem     && "💎"}
      {isMine    && "💣"}
      {isMineHid && <span style={{ opacity: 0.35, fontSize: "0.75em" }}>💣</span>}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function MinesGame({ initialBalance }: { initialBalance: string }) {
  const [balance,    setBalance]    = useState(parseFloat(initialBalance) || 0);
  const [demoMode,   setDemoMode]   = useState(false);
  const [betAmount,  setBetAmount]  = useState("5");
  const [mineCount,  setMineCount]  = useState(3);
  const [phase,      setPhase]      = useState<Phase>("idle");
  const [tiles,      setTiles]      = useState<TileState[]>(Array(25).fill("hidden"));
  const [multiplier, setMultiplier] = useState(1);
  const [revealedCount, setRevealedCount] = useState(0);
  const [gameId,     setGameId]     = useState<string | null>(null);
  const [demoMines,  setDemoMines]  = useState<Set<number>>(new Set());
  const [payout,     setPayout]     = useState<number | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);

  const bet = parseFloat(betAmount) || 0;
  const potentialPayout = bet * multiplier;
  const totalSafe = 25 - mineCount;

  // ---------------------------------------------------------------------------
  // Start game
  // ---------------------------------------------------------------------------
  async function startGame() {
    if (loading || bet <= 0) return;
    setError(null);
    setPayout(null);
    setTiles(Array(25).fill("hidden"));
    setMultiplier(1);
    setRevealedCount(0);
    setPhase("active");

    if (demoMode) {
      setDemoMines(generateMines(mineCount));
      setGameId(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/games/mines/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet_amount: bet, mine_count: mineCount }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Failed to start.");
        setPhase("idle");
        return;
      }
      setGameId(data.game_id);
      if (data.new_balance !== null) setBalance(parseFloat(data.new_balance));
    } catch {
      setError("Network error.");
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Reveal tile
  // ---------------------------------------------------------------------------
  async function revealTile(index: number) {
    if (phase !== "active" || loading || tiles[index] !== "hidden") return;
    setError(null);

    if (demoMode) {
      const isMine = demoMines.has(index);
      const newTiles = [...tiles];
      if (isMine) {
        newTiles[index] = "mine";
        // Reveal remaining mines as dimmed
        demoMines.forEach((m) => { if (m !== index && newTiles[m] === "hidden") newTiles[m] = "mine_hidden"; });
        setTiles(newTiles);
        setPhase("exploded");
      } else {
        newTiles[index] = "gem";
        const newRevealed = revealedCount + 1;
        const newMult = calcMultiplier(newRevealed, mineCount);
        setTiles(newTiles);
        setRevealedCount(newRevealed);
        setMultiplier(newMult);
        if (newRevealed === totalSafe) {
          // Auto-cashout in demo
          setPayout(bet * newMult);
          demoMines.forEach((m) => { if (newTiles[m] === "hidden") newTiles[m] = "mine_hidden"; });
          setTiles([...newTiles]);
          setPhase("cashed_out");
        }
      }
      return;
    }

    if (!gameId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/games/mines/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId, tile_index: index }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Reveal failed.");
        setLoading(false);
        return;
      }

      const newTiles = [...tiles];
      if (data.is_mine) {
        newTiles[index] = "mine";
        // Show all mine positions
        (data.mine_positions as number[]).forEach((m) => {
          if (m !== index && newTiles[m] === "hidden") newTiles[m] = "mine_hidden";
        });
        setTiles(newTiles);
        setPhase("exploded");
        if (data.new_balance !== null) setBalance(parseFloat(data.new_balance));
      } else {
        newTiles[index] = "gem";
        setTiles(newTiles);
        const newRevealed = revealedCount + 1;
        setRevealedCount(newRevealed);
        setMultiplier(parseFloat(data.multiplier));
        if (data.status === "cashed_out") {
          // Auto-cashout (all safe tiles revealed)
          (data.mine_positions as number[]).forEach((m) => {
            if (newTiles[m] === "hidden") newTiles[m] = "mine_hidden";
          });
          setTiles([...newTiles]);
          setPayout(parseFloat(data.net_payout));
          setPhase("cashed_out");
          if (data.new_balance !== null) setBalance(parseFloat(data.new_balance));
        }
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Cash out
  // ---------------------------------------------------------------------------
  async function cashout() {
    if (phase !== "active" || revealedCount === 0 || loading) return;
    setError(null);

    if (demoMode) {
      const p = bet * multiplier;
      setPayout(p);
      const newTiles = [...tiles];
      demoMines.forEach((m) => { if (newTiles[m] === "hidden") newTiles[m] = "mine_hidden"; });
      setTiles(newTiles);
      setPhase("cashed_out");
      return;
    }

    if (!gameId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/games/mines/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Cashout failed.");
        setLoading(false);
        return;
      }
      const newTiles = [...tiles];
      (data.mine_positions as number[]).forEach((m) => {
        if (newTiles[m] === "hidden") newTiles[m] = "mine_hidden";
      });
      setTiles(newTiles);
      setPayout(parseFloat(data.net_payout));
      setPhase("cashed_out");
      if (data.new_balance !== null) setBalance(parseFloat(data.new_balance));
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPhase("idle");
    setTiles(Array(25).fill("hidden"));
    setMultiplier(1);
    setRevealedCount(0);
    setGameId(null);
    setPayout(null);
    setError(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Balance + demo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          Balance: <span style={{ color: "var(--gold)", fontWeight: 600 }}>${balance.toFixed(2)} USDT</span>
        </div>
        <button
          onClick={() => { if (phase === "idle") setDemoMode((d) => !d); }}
          disabled={phase !== "idle"}
          style={{
            fontSize: "0.75rem", fontWeight: 500, padding: "4px 10px", borderRadius: 6,
            border: demoMode ? "1px solid #3a6a3a" : "1px solid var(--border-subtle)",
            background: demoMode ? "#0f2a0f" : "transparent",
            color: demoMode ? "#7ecf7e" : "var(--text-dim)",
            cursor: phase === "idle" ? "pointer" : "default",
          }}
        >
          {demoMode ? "Demo ON" : "Demo OFF"}
        </button>
      </div>

      {/* Setup panel (only shown when idle) */}
      {phase === "idle" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Mines */}
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
              Mines
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {MINE_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setMineCount(p)}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 6, fontSize: "0.8125rem", fontWeight: 600,
                    border: mineCount === p ? "1px solid var(--rose)" : "1px solid var(--border-subtle)",
                    background: mineCount === p ? "rgba(239,68,68,0.12)" : "transparent",
                    color: mineCount === p ? "var(--rose)" : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              type="number" min={1} max={24} value={mineCount}
              onChange={(e) => setMineCount(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
              style={{ width: "100%", marginTop: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "0.875rem", boxSizing: "border-box" }}
            />
          </div>

          {/* Bet */}
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
              Bet Amount
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {BET_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setBetAmount(String(p))}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 6, fontSize: "0.8125rem", fontWeight: 600,
                    border: betAmount === String(p) ? "1px solid var(--gold)" : "1px solid var(--border-subtle)",
                    background: betAmount === String(p) ? "var(--gold-dim)" : "transparent",
                    color: betAmount === String(p) ? "var(--gold)" : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  ${p}
                </button>
              ))}
            </div>
            <input
              type="number" min={1} max={500} value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "0.875rem", boxSizing: "border-box" }}
              placeholder="Custom amount"
            />
          </div>

          {/* Multiplier preview */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[1, 2, 3, 5].map((k) => {
              if (k > totalSafe) return null;
              const m = calcMultiplier(k, mineCount);
              return (
                <div key={k} style={{ flex: 1, minWidth: 60, padding: "8px 6px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-dim)", textAlign: "center" }}>
                  <div style={{ fontSize: "0.625rem", color: "var(--text-dim)", marginBottom: 2 }}>{k} gem{k > 1 ? "s" : ""}</div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--gold)" }}>{m.toFixed(2)}×</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active multiplier display */}
      {phase === "active" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginBottom: 2 }}>Multiplier</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--gold)" }}>
              {multiplier.toFixed(2)}×
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginBottom: 2 }}>Potential</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 600, color: revealedCount > 0 ? "#22c55e" : "var(--text-secondary)" }}>
              ${potentialPayout.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Result banner */}
      <AnimatePresence>
        {(phase === "cashed_out" || phase === "exploded") && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: "14px 16px", borderRadius: 10, textAlign: "center",
              border: phase === "cashed_out" ? "1px solid var(--border-gold)" : "1px solid #7f1d1d",
              background: phase === "cashed_out" ? "var(--gold-dim)" : "rgba(127,29,29,0.18)",
            }}
          >
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: phase === "cashed_out" ? "var(--gold)" : "var(--rose)", marginBottom: 4 }}>
              {phase === "cashed_out"
                ? `+$${((payout ?? 0) - bet).toFixed(2)} profit`
                : "💥 Mine hit — better luck next time"}
            </div>
            {phase === "cashed_out" && payout !== null && (
              <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                {revealedCount} gem{revealedCount !== 1 ? "s" : ""} · {multiplier.toFixed(2)}× · ${payout.toFixed(2)} returned
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
        {tiles.map((state, i) => (
          <Tile
            key={i}
            index={i}
            state={state}
            onClick={() => revealTile(i)}
            disabled={phase !== "active" || loading}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(127,29,29,0.2)", border: "1px solid #7f1d1d", color: "var(--rose)", fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      {phase === "idle" && (
        <button
          onClick={startGame}
          disabled={loading || bet <= 0}
          style={{
            padding: "14px 0", borderRadius: 10, fontSize: "1rem", fontWeight: 700,
            fontFamily: "var(--font-display)", letterSpacing: "0.04em",
            cursor: bet > 0 ? "pointer" : "not-allowed",
            border: demoMode ? "1px solid #3a6a3a" : "none",
            background: demoMode
              ? "linear-gradient(135deg, #1a3a1a, #0f2a0f)"
              : "linear-gradient(135deg, var(--gold-btn-light), var(--gold-btn))",
            color: demoMode ? "#7ecf7e" : "#070809",
          }}
        >
          {demoMode ? "Demo — Start Game" : `Start — $${bet.toFixed(2)}`}
        </button>
      )}

      {phase === "active" && (
        <button
          onClick={cashout}
          disabled={revealedCount === 0 || loading}
          style={{
            padding: "14px 0", borderRadius: 10, fontSize: "1rem", fontWeight: 700,
            fontFamily: "var(--font-display)", letterSpacing: "0.04em",
            cursor: revealedCount > 0 ? "pointer" : "not-allowed",
            border: "none",
            background: revealedCount > 0
              ? "linear-gradient(135deg, #166534, #15803d)"
              : "var(--bg-elevated)",
            color: revealedCount > 0 ? "#fff" : "var(--text-dim)",
            transition: "background 150ms",
          }}
        >
          {revealedCount === 0
            ? "Reveal a gem first"
            : `💰 Cash Out — $${potentialPayout.toFixed(2)}`}
        </button>
      )}

      {(phase === "cashed_out" || phase === "exploded") && (
        <button
          onClick={reset}
          style={{
            padding: "14px 0", borderRadius: 10, fontSize: "1rem", fontWeight: 700,
            fontFamily: "var(--font-display)", letterSpacing: "0.04em",
            cursor: "pointer", border: "1px solid var(--border-dim)",
            background: "var(--bg-elevated)", color: "var(--text-primary)",
          }}
        >
          Play Again
        </button>
      )}

      {/* Rules */}
      <div style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border-dim)", background: "var(--bg-surface)" }}>
        <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", lineHeight: 1.65 }}>
          <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>How to play</strong>
          Pick how many mines hide in the 5×5 grid, set your bet, then reveal tiles.
          Each 💎 increases your multiplier. Hit a 💣 and you lose everything.
          Cash out any time after your first gem. More mines = higher multipliers. 2% fee on profits only.
        </div>
      </div>
    </div>
  );
}
