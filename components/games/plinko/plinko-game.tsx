"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ROWS = 16;
const SLOTS = ROWS + 1; // 17 slots

const MULTIPLIERS = {
  low:    [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  high:   [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
};

const BET_PRESETS = [1, 5, 25, 100];

type Risk = "low" | "medium" | "high";

function multColor(m: number): string {
  if (m >= 10)  return "#ef4444";
  if (m >= 3)   return "#f97316";
  if (m >= 1.5) return "#eab308";
  if (m >= 1)   return "#22c55e";
  return "var(--text-dim)";
}

// Simulate ball path client-side (decorative — outcome already known from server)
function simulatePath(targetSlot: number): boolean[] {
  // Work backwards: we need exactly targetSlot right-turns in 16 rows
  // Simple approach: shuffle then fix to match count
  const path: boolean[] = [];
  let rights = targetSlot;
  let lefts  = ROWS - targetSlot;
  for (let i = 0; i < ROWS; i++) {
    const remaining = ROWS - i;
    const pRight = rights / remaining;
    const goRight = Math.random() < pRight;
    path.push(goRight);
    if (goRight) rights--; else lefts--;
  }
  return path;
}

// Peg board SVG
function PlinkoBoard({ path, dropping, activeRow, finalSlot, risk }: {
  path: boolean[];
  dropping: boolean;
  activeRow: number;
  finalSlot: number | null;
  risk: Risk;
}) {
  const W = 400;
  const H = 360;
  const pegR = 4;
  const topPad = 24;
  const rowH = (H - topPad - 40) / (ROWS + 1);
  const slotH = 32;
  const mults = MULTIPLIERS[risk];

  // Peg positions: row r has r+1 pegs, centred
  function pegX(row: number, col: number): number {
    const totalPegs = row + 1;
    const spacing   = W / (totalPegs + 1);
    return spacing * (col + 1);
  }
  function pegY(row: number): number {
    return topPad + rowH * (row + 1);
  }

  // Ball position along path
  let ballX = W / 2;
  let ballY = topPad + rowH * 0.5;
  if (dropping && path.length > 0) {
    const col = path.slice(0, activeRow).filter(Boolean).length;
    const row = Math.min(activeRow, ROWS);
    if (row === 0) {
      ballX = W / 2;
      ballY = topPad;
    } else {
      const totalPegs = row;
      const spacing   = W / (totalPegs + 2);
      ballX = spacing * (col + 1);
      ballY = pegY(row - 1) + rowH * 0.5;
    }
  } else if (!dropping && finalSlot !== null) {
    const spacing = W / (SLOTS + 1);
    ballX = spacing * (finalSlot + 1);
    ballY = H - slotH - 8;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* Pegs */}
      {Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: r + 2 }, (_, c) => (
          <circle
            key={`${r}-${c}`}
            cx={pegX(r, c)}
            cy={pegY(r)}
            r={pegR}
            fill={dropping && r < activeRow ? "var(--gold)" : "rgba(255,255,255,0.25)"}
            style={{ transition: "fill 80ms" }}
          />
        ))
      )}

      {/* Ball */}
      {(dropping || finalSlot !== null) && (
        <motion.circle
          cx={ballX}
          cy={ballY}
          r={8}
          fill="#38bdf8"
          style={{ filter: "drop-shadow(0 0 6px #38bdf8)" }}
          animate={{ cx: ballX, cy: ballY }}
          transition={{ duration: 0.12, ease: "easeOut" }}
        />
      )}

      {/* Slot labels */}
      {mults.map((m, i) => {
        const spacing = W / (SLOTS + 1);
        const x = spacing * (i + 1);
        const y = H - slotH / 2;
        const isLanding = finalSlot === i && !dropping;
        return (
          <g key={i}>
            <rect
              x={x - spacing * 0.42}
              y={H - slotH}
              width={spacing * 0.84}
              height={slotH - 2}
              rx={4}
              fill={isLanding ? multColor(m) : "var(--bg-elevated)"}
              stroke={isLanding ? multColor(m) : "var(--border-dim)"}
              strokeWidth={1}
              style={{ transition: "fill 200ms" }}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize={spacing > 26 ? 9 : 7}
              fontWeight="700"
              fill={isLanding ? "#fff" : multColor(m)}
              fontFamily="monospace"
            >
              {m >= 10 ? `${m}×` : `${m}×`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function PlinkoGame({ initialBalance }: { initialBalance: string }) {
  const [balance,   setBalance]   = useState(parseFloat(initialBalance) || 0);
  const [demoMode,  setDemoMode]  = useState(false);
  const [betAmount, setBetAmount] = useState("5");
  const [risk,      setRisk]      = useState<Risk>("medium");
  const [dropping,  setDropping]  = useState(false);
  const [path,      setPath]      = useState<boolean[]>([]);
  const [activeRow, setActiveRow] = useState(0);
  const [finalSlot, setFinalSlot] = useState<number | null>(null);
  const [result,    setResult]    = useState<{ multiplier: number; payout: number } | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [history,   setHistory]   = useState<{ slot: number; mult: number; won: boolean }[]>([]);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bet   = parseFloat(betAmount) || 0;
  const mults = MULTIPLIERS[risk];

  async function drop() {
    if (dropping || bet <= 0) return;
    setError(null);
    setResult(null);
    setFinalSlot(null);
    setActiveRow(0);
    setPath([]);

    let serverSlot: number;
    let serverMult: number;
    let serverPayout: number;

    if (demoMode) {
      serverSlot  = Math.floor(Math.random() * SLOTS);
      serverMult  = mults[serverSlot];
      serverPayout = bet * serverMult;
    } else {
      try {
        const res = await fetch("/api/games/plinko/drop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bet_amount: bet, risk }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.message ?? "Drop failed.");
          return;
        }
        serverSlot   = data.slot;
        serverMult   = parseFloat(data.multiplier);
        serverPayout = parseFloat(data.net_payout);
        if (data.new_balance !== null) setBalance(parseFloat(data.new_balance));
      } catch {
        setError("Network error.");
        return;
      }
    }

    // Animate ball with pre-computed path matching server result
    const ballPath = simulatePath(serverSlot);
    setPath(ballPath);
    setDropping(true);

    for (let r = 0; r <= ROWS; r++) {
      await new Promise<void>(resolve => {
        animRef.current = setTimeout(resolve, 80);
      });
      setActiveRow(r);
    }

    setDropping(false);
    setFinalSlot(serverSlot);
    setResult({ multiplier: serverMult, payout: serverPayout });
    setHistory(h => [{ slot: serverSlot, mult: serverMult, won: serverMult >= 1 }, ...h].slice(0, 15));
  }

  useEffect(() => () => { if (animRef.current) clearTimeout(animRef.current); }, []);

  const profit = result ? result.payout - bet : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Balance + demo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          Balance: <span style={{ color: "var(--gold)", fontWeight: 600 }}>${balance.toFixed(2)} USDT</span>
        </div>
        <button
          onClick={() => setDemoMode(d => !d)}
          style={{
            fontSize: "0.75rem", fontWeight: 500, padding: "4px 10px", borderRadius: 6,
            border: demoMode ? "1px solid #3a6a3a" : "1px solid var(--border-subtle)",
            background: demoMode ? "#0f2a0f" : "transparent",
            color: demoMode ? "#7ecf7e" : "var(--text-dim)", cursor: "pointer",
          }}
        >
          {demoMode ? "Demo ON" : "Demo OFF"}
        </button>
      </div>

      {/* Board */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "12px 8px" }}>
        <PlinkoBoard path={path} dropping={dropping} activeRow={activeRow} finalSlot={finalSlot} risk={risk} />
      </div>

      {/* Result banner */}
      <AnimatePresence>
        {result && !dropping && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              padding: "12px 16px", borderRadius: 10, textAlign: "center",
              border: profit > 0 ? "1px solid var(--border-gold)" : "1px solid var(--border-dim)",
              background: profit > 0 ? "var(--gold-dim)" : "var(--bg-elevated)",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "1.1rem", color: profit > 0 ? "var(--gold)" : profit < 0 ? "var(--rose)" : "var(--text-secondary)" }}>
              {profit > 0 ? `+$${profit.toFixed(2)}` : profit < 0 ? `-$${Math.abs(profit).toFixed(2)}` : "Push"}
            </span>
            <span style={{ color: "var(--text-dim)", fontSize: "0.8125rem", marginLeft: 8 }}>
              {result.multiplier}× · slot {finalSlot}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Risk + bet */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Risk</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["low", "medium", "high"] as Risk[]).map(r => (
              <button key={r} onClick={() => setRisk(r)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 6, fontSize: "0.8125rem", fontWeight: 600, textTransform: "capitalize",
                  border: risk === r ? "1px solid var(--gold)" : "1px solid var(--border-subtle)",
                  background: risk === r ? "var(--gold-dim)" : "transparent",
                  color: risk === r ? "var(--gold)" : "var(--text-secondary)", cursor: "pointer",
                }}
              >{r}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>Bet Amount</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {BET_PRESETS.map(p => (
              <button key={p} onClick={() => setBetAmount(String(p))}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 6, fontSize: "0.8125rem", fontWeight: 600,
                  border: betAmount === String(p) ? "1px solid var(--gold)" : "1px solid var(--border-subtle)",
                  background: betAmount === String(p) ? "var(--gold-dim)" : "transparent",
                  color: betAmount === String(p) ? "var(--gold)" : "var(--text-secondary)", cursor: "pointer",
                }}
              >${p}</button>
            ))}
          </div>
          <input type="number" min={1} max={500} value={betAmount} onChange={e => setBetAmount(e.target.value)}
            style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "0.875rem", boxSizing: "border-box" }}
            placeholder="Custom amount" />
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {history.map((h, i) => (
            <div key={i} style={{
              padding: "3px 8px", borderRadius: 4, fontSize: "0.6875rem", fontWeight: 700,
              background: h.won ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
              color: multColor(h.mult),
              border: `1px solid ${h.won ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            }}>{h.mult}×</div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(127,29,29,0.2)", border: "1px solid #7f1d1d", color: "var(--rose)", fontSize: "0.8125rem" }}>{error}</div>
      )}

      <button
        onClick={drop}
        disabled={dropping || bet <= 0}
        style={{
          padding: "14px 0", borderRadius: 10, fontSize: "1rem", fontWeight: 700,
          fontFamily: "var(--font-display)", letterSpacing: "0.04em",
          cursor: dropping || bet <= 0 ? "not-allowed" : "pointer",
          border: dropping || bet <= 0 ? "1px solid var(--border-dim)" : demoMode ? "1px solid #3a6a3a" : "none",
          background: dropping || bet <= 0 ? "var(--bg-elevated)" : demoMode ? "linear-gradient(135deg,#1a3a1a,#0f2a0f)" : "linear-gradient(135deg,var(--gold-btn-light),var(--gold-btn))",
          color: dropping || bet <= 0 ? "var(--text-dim)" : demoMode ? "#7ecf7e" : "#070809",
        }}
      >
        {dropping ? "Dropping…" : demoMode ? `Demo Drop — $${bet.toFixed(2)}` : `Drop — $${bet.toFixed(2)}`}
      </button>
    </div>
  );
}
