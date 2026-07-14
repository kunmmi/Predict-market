"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BET_PRESETS = [1, 5, 25, 100];

function calcMultiplier(target: number, direction: "over" | "under"): number {
  const winCount = direction === "over" ? 99 - target : target;
  return Math.round((99 / winCount) * 100) / 100;
}

function calcWinChance(target: number, direction: "over" | "under"): number {
  const winCount = direction === "over" ? 99 - target : target;
  return Math.round((winCount / 100) * 10000) / 100;
}

export function DiceGame({ initialBalance }: { initialBalance: string }) {
  const [balance,   setBalance]   = useState(parseFloat(initialBalance) || 0);
  const [demoMode,  setDemoMode]  = useState(false);
  const [betAmount, setBetAmount] = useState("5");
  const [target,    setTarget]    = useState(50);
  const [direction, setDirection] = useState<"over" | "under">("over");
  const [rolling,   setRolling]   = useState(false);
  const [roll,      setRoll]      = useState<number | null>(null);
  const [won,       setWon]       = useState<boolean | null>(null);
  const [payout,    setPayout]    = useState<number | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [history,   setHistory]   = useState<{ roll: number; won: boolean }[]>([]);

  const bet  = parseFloat(betAmount) || 0;
  const mult = calcMultiplier(target, direction);
  const chance = calcWinChance(target, direction);

  async function doRoll() {
    if (rolling || bet <= 0) return;
    setError(null);
    setRoll(null);
    setWon(null);
    setPayout(null);
    setRolling(true);

    if (demoMode) {
      await new Promise(r => setTimeout(r, 600));
      const r = Math.floor(Math.random() * 100);
      const w = direction === "over" ? r > target : r < target;
      setRoll(r);
      setWon(w);
      setPayout(w ? bet * mult : 0);
      setHistory(h => [{ roll: r, won: w }, ...h].slice(0, 20));
      setRolling(false);
      return;
    }

    try {
      const res = await fetch("/api/games/dice/roll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet_amount: bet, target, direction }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Roll failed.");
        setRolling(false);
        return;
      }
      await new Promise(r => setTimeout(r, 600));
      setRoll(data.roll);
      setWon(data.won);
      setPayout(parseFloat(data.net_payout));
      setHistory(h => [{ roll: data.roll, won: data.won }, ...h].slice(0, 20));
      if (data.new_balance !== null) setBalance(parseFloat(data.new_balance));
    } catch {
      setError("Network error.");
    } finally {
      setRolling(false);
    }
  }

  const winZoneLeft  = direction === "over" ? `${(target + 1)}%` : "0%";
  const winZoneWidth = direction === "over" ? `${99 - target}%` : `${target}%`;

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

      {/* Roll result display */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px 16px" }}>
        {/* Big roll number */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <AnimatePresence mode="wait">
            {rolling ? (
              <motion.div
                key="rolling"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ fontSize: "3.5rem", fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--text-dim)", letterSpacing: "-0.02em" }}
              >
                ?
              </motion.div>
            ) : roll !== null ? (
              <motion.div
                key={roll}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                style={{ fontSize: "3.5rem", fontWeight: 800, fontFamily: "var(--font-display)", color: won ? "#22c55e" : "var(--rose)", letterSpacing: "-0.02em" }}
              >
                {roll.toString().padStart(2, "0")}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                style={{ fontSize: "3.5rem", fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--border-subtle)", letterSpacing: "-0.02em" }}
              >
                --
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Slider track */}
        <div style={{ position: "relative", height: 36, marginBottom: 8 }}>
          {/* Track */}
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 8, borderRadius: 4, background: "var(--bg-elevated)", transform: "translateY(-50%)" }} />

          {/* Win zone */}
          <div style={{
            position: "absolute", top: "50%", left: winZoneLeft, width: winZoneWidth,
            height: 8, borderRadius: 4, background: "rgba(34,197,94,0.5)", transform: "translateY(-50%)",
            transition: "left 150ms ease, width 150ms ease",
          }} />

          {/* Target marker */}
          <div style={{
            position: "absolute", top: "50%", left: `${target}%`,
            width: 3, height: 20, background: "var(--gold)", borderRadius: 2,
            transform: "translate(-50%, -50%)",
            transition: "left 150ms ease",
          }} />

          {/* Roll result dot */}
          {roll !== null && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                position: "absolute", top: "50%", left: `${roll}%`,
                width: 16, height: 16, borderRadius: "50%",
                background: won ? "#22c55e" : "var(--rose)",
                border: "2px solid var(--bg-card)",
                transform: "translate(-50%, -50%)",
                boxShadow: `0 0 8px ${won ? "#22c55e" : "#ef4444"}`,
              }}
            />
          )}
        </div>

        {/* Scale labels */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--text-dim)" }}>
          <span>0</span><span>25</span><span>50</span><span>75</span><span>99</span>
        </div>

        {/* Target slider */}
        <input
          type="range" min={2} max={98} value={target}
          onChange={e => setTarget(parseInt(e.target.value))}
          style={{ width: "100%", marginTop: 12, accentColor: "var(--gold)" }}
        />
      </div>

      {/* Result banner */}
      <AnimatePresence>
        {won !== null && !rolling && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              padding: "12px 16px", borderRadius: 10, textAlign: "center",
              border: won ? "1px solid var(--border-gold)" : "1px solid #7f1d1d",
              background: won ? "var(--gold-dim)" : "rgba(127,29,29,0.18)",
            }}
          >
            <span style={{ fontWeight: 700, color: won ? "var(--gold)" : "var(--rose)" }}>
              {won ? `+$${((payout ?? 0) - bet).toFixed(2)} profit · ${mult}×` : `Lost $${bet.toFixed(2)}`}
            </span>
            <span style={{ color: "var(--text-dim)", fontSize: "0.8125rem", marginLeft: 8 }}>
              Roll: {roll} · {direction} {target}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Over / Under + stats */}
      <div style={{ display: "flex", gap: 8 }}>
        {(["under", "over"] as const).map(d => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 8, fontWeight: 600, fontSize: "0.875rem",
              border: direction === d ? "1px solid var(--gold)" : "1px solid var(--border-subtle)",
              background: direction === d ? "var(--gold-dim)" : "transparent",
              color: direction === d ? "var(--gold)" : "var(--text-secondary)",
              cursor: "pointer", textTransform: "capitalize",
            }}
          >
            {d} {target}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { label: "Multiplier", value: `${mult}×` },
          { label: "Win Chance", value: `${chance}%` },
          { label: "Payout", value: `$${(bet * mult).toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-dim)", textAlign: "center" }}>
            <div style={{ fontSize: "0.625rem", color: "var(--text-dim)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Bet amount */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 16 }}>
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

      {/* History */}
      {history.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {history.map((h, i) => (
            <div key={i} style={{
              width: 32, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.6875rem", fontWeight: 700,
              background: h.won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              color: h.won ? "#22c55e" : "var(--rose)",
              border: `1px solid ${h.won ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}>{h.roll}</div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(127,29,29,0.2)", border: "1px solid #7f1d1d", color: "var(--rose)", fontSize: "0.8125rem" }}>{error}</div>
      )}

      {/* Roll button */}
      <button
        onClick={doRoll}
        disabled={rolling || bet <= 0}
        style={{
          padding: "14px 0", borderRadius: 10, fontSize: "1rem", fontWeight: 700,
          fontFamily: "var(--font-display)", letterSpacing: "0.04em",
          cursor: rolling || bet <= 0 ? "not-allowed" : "pointer",
          border: rolling || bet <= 0 ? "1px solid var(--border-dim)" : demoMode ? "1px solid #3a6a3a" : "none",
          background: rolling || bet <= 0 ? "var(--bg-elevated)" : demoMode ? "linear-gradient(135deg,#1a3a1a,#0f2a0f)" : "linear-gradient(135deg,var(--gold-btn-light),var(--gold-btn))",
          color: rolling || bet <= 0 ? "var(--text-dim)" : demoMode ? "#7ecf7e" : "#070809",
        }}
      >
        {rolling ? "Rolling…" : demoMode ? `Demo Roll — $${bet.toFixed(2)}` : `🎲 Roll — $${bet.toFixed(2)}`}
      </button>

      <div style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border-dim)", background: "var(--bg-surface)" }}>
        <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", lineHeight: 1.65 }}>
          <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>How to play</strong>
          Set a target (2–98) and bet whether the roll will be over or under it. Drag the slider to adjust your risk.
          Lower win chance = higher multiplier. 2% fee on profits only.
        </div>
      </div>
    </div>
  );
}
