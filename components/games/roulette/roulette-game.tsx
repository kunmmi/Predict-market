"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

// European wheel number order (clockwise from 0)
const WHEEL_ORDER = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,
  24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26,
];

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

type BetType = "red"|"black"|"odd"|"even"|"low"|"high"|"dozen1"|"dozen2"|"dozen3"|"straight";

interface Bet {
  type: BetType;
  amount: number;
  number?: number;
}

interface SpinResult {
  winning_number: number;
  net_payout: number;
  fee: number;
  gross_payout: number;
}

const BET_LABELS: Record<string, string> = {
  red: "Red", black: "Black", odd: "Odd", even: "Even",
  low: "1–18", high: "19–36",
  dozen1: "1st 12", dozen2: "2nd 12", dozen3: "3rd 12",
};

const PAYOUTS: Record<string, string> = {
  red: "1:1", black: "1:1", odd: "1:1", even: "1:1",
  low: "1:1", high: "1:1",
  dozen1: "2:1", dozen2: "2:1", dozen3: "2:1",
  straight: "35:1",
};

const PRESET_AMOUNTS = [1, 5, 25, 100];

// Simple SVG roulette wheel
function RouletteWheel({ spinning, winningNumber }: { spinning: boolean; winningNumber: number | null }) {
  const segments = WHEEL_ORDER.length;
  const anglePerSegment = 360 / segments;
  const r = 110;
  const cx = 130;
  const cy = 130;

  // Compute rotation so winning number lands at top (12 o'clock = -90deg)
  const winIdx = winningNumber !== null ? WHEEL_ORDER.indexOf(winningNumber) : 0;
  const targetAngle = -(winIdx * anglePerSegment) - 90 + anglePerSegment / 2;
  // Add extra full rotations for spin feel (4 full rotations)
  const spinAngle = spinning ? 0 : targetAngle + 4 * 360;

  return (
    <div style={{ position: "relative", width: 260, height: 260, margin: "0 auto" }}>
      <motion.svg
        width={260}
        height={260}
        viewBox="0 0 260 260"
        animate={{ rotate: spinning ? [0, 720] : spinAngle }}
        transition={
          spinning
            ? { duration: 1.5, ease: "linear", repeat: Infinity }
            : { duration: 0, ease: "linear" }
        }
        style={{ display: "block" }}
      >
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={r + 14} fill="#1a1005" stroke="var(--gold)" strokeWidth={2} />

        {WHEEL_ORDER.map((num, i) => {
          const startAngle = ((i * anglePerSegment - 90) * Math.PI) / 180;
          const endAngle = (((i + 1) * anglePerSegment - 90) * Math.PI) / 180;
          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cy + r * Math.sin(endAngle);
          const largeArc = anglePerSegment > 180 ? 1 : 0;
          const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;

          const color = getColor(num);
          const fillColor = color === "green" ? "#065f46" : color === "red" ? "#7f1d1d" : "#111";

          // Label angle
          const midAngle = ((i + 0.5) * anglePerSegment - 90) * (Math.PI / 180);
          const labelR = r * 0.72;
          const lx = cx + labelR * Math.cos(midAngle);
          const ly = cy + labelR * Math.sin(midAngle);
          const textAngle = (i + 0.5) * anglePerSegment;

          return (
            <g key={num}>
              <path d={d} fill={fillColor} stroke="#2a1f0a" strokeWidth={0.5} />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={anglePerSegment > 12 ? 7 : 6}
                fill="#e5d5a0"
                fontWeight="600"
                transform={`rotate(${textAngle}, ${lx}, ${ly})`}
              >
                {num}
              </text>
            </g>
          );
        })}

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={18} fill="#0a0602" stroke="var(--gold)" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={8} fill="var(--gold)" />
      </motion.svg>

      {/* Fixed pointer at top */}
      <div style={{
        position: "absolute",
        top: 4,
        left: "50%",
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        borderTop: "14px solid var(--gold)",
        filter: "drop-shadow(0 0 4px var(--gold-glow))",
        zIndex: 2,
      }} />
    </div>
  );
}

function NumberGrid({
  onStraightBet,
  straightBets,
}: {
  onStraightBet: (n: number) => void;
  straightBets: Record<number, number>;
}) {
  const rows: number[][] = [];
  for (let row = 12; row >= 1; row--) {
    rows.push([row * 3 - 2, row * 3 - 1, row * 3]);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, marginBottom: 2 }}>
        {/* 0 */}
        <button
          onClick={() => onStraightBet(0)}
          style={{
            gridColumn: "1 / -1",
            padding: "6px 0",
            borderRadius: 4,
            border: straightBets[0] ? "1px solid var(--gold)" : "1px solid var(--border-subtle)",
            background: straightBets[0] ? "var(--gold-dim)" : "#065f46",
            color: straightBets[0] ? "var(--gold)" : "#e5d5a0",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          0 {straightBets[0] ? `($${straightBets[0]})` : ""}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
        {rows.flat().map((n) => {
          const color = getColor(n);
          const hasBet = !!straightBets[n];
          return (
            <button
              key={n}
              onClick={() => onStraightBet(n)}
              style={{
                padding: "7px 0",
                borderRadius: 4,
                border: hasBet ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.08)",
                background: hasBet
                  ? "var(--gold-dim)"
                  : color === "red"
                  ? "#7f1d1d"
                  : "#111",
                color: hasBet ? "var(--gold)" : "#e5d5a0",
                fontSize: "0.6875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RouletteGame({ initialBalance }: { initialBalance: string }) {
  const [balance, setBalance] = useState(parseFloat(initialBalance) || 0);
  const [demoMode, setDemoMode] = useState(false);
  const [betAmount, setBetAmount] = useState("5");
  const [outsideBets, setOutsideBets] = useState<Record<string, number>>({});
  const [straightBets, setStraightBets] = useState<Record<number, number>>({});
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [animatingNumber, setAnimatingNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [tab, setTab] = useState<"outside" | "numbers">("outside");
  const [error, setError] = useState<string | null>(null);

  const totalBet = Object.values(outsideBets).reduce((s, v) => s + v, 0) +
    Object.values(straightBets).reduce((s, v) => s + v, 0);

  function toggleOutsideBet(type: string) {
    const amt = parseFloat(betAmount) || 0;
    if (amt <= 0) return;
    setOutsideBets((prev) => {
      if (prev[type]) {
        const next = { ...prev };
        delete next[type];
        return next;
      }
      return { ...prev, [type]: amt };
    });
  }

  function handleStraightBet(n: number) {
    const amt = parseFloat(betAmount) || 0;
    if (amt <= 0) return;
    setStraightBets((prev) => {
      if (prev[n]) {
        const next = { ...prev };
        delete next[n];
        return next;
      }
      return { ...prev, [n]: amt };
    });
  }

  function clearBets() {
    setOutsideBets({});
    setStraightBets({});
    setResult(null);
    setAnimatingNumber(null);
  }

  async function spin() {
    if (spinning || totalBet === 0) return;
    setError(null);
    setResult(null);
    setAnimatingNumber(null);
    setSpinning(true);

    if (demoMode) {
      await new Promise((r) => setTimeout(r, 2500));
      const winNum = Math.floor(Math.random() * 37);
      const bets = buildBets();
      let gross = 0;
      for (const b of bets) {
        gross += calcDemoPayout(b, winNum);
      }
      const fee = gross > totalBet ? (gross - totalBet) * 0.02 : 0;
      setAnimatingNumber(winNum);
      setResult({ winning_number: winNum, gross_payout: gross, fee, net_payout: gross - fee });
      setHistory((h) => [winNum, ...h].slice(0, 15));
      setSpinning(false);
      return;
    }

    const bets = buildBets();
    try {
      const res = await fetch("/api/games/roulette/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bets }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Spin failed.");
        setSpinning(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 2500));
      setAnimatingNumber(data.winning_number);
      setResult(data);
      if (data.new_balance !== null) setBalance(parseFloat(data.new_balance));
      setHistory((h) => [data.winning_number, ...h].slice(0, 15));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSpinning(false);
    }
  }

  function buildBets(): Bet[] {
    const bets: Bet[] = [];
    for (const [type, amount] of Object.entries(outsideBets)) {
      bets.push({ type: type as BetType, amount });
    }
    for (const [numStr, amount] of Object.entries(straightBets)) {
      bets.push({ type: "straight", amount, number: parseInt(numStr) });
    }
    return bets;
  }

  function calcDemoPayout(bet: Bet, win: number): number {
    const { type, amount, number } = bet;
    if (type === "straight") return win === number ? amount * 36 : 0;
    if (type === "red") return RED_NUMBERS.has(win) ? amount * 2 : 0;
    if (type === "black") return win > 0 && !RED_NUMBERS.has(win) ? amount * 2 : 0;
    if (type === "odd") return win > 0 && win % 2 === 1 ? amount * 2 : 0;
    if (type === "even") return win > 0 && win % 2 === 0 ? amount * 2 : 0;
    if (type === "low") return win >= 1 && win <= 18 ? amount * 2 : 0;
    if (type === "high") return win >= 19 && win <= 36 ? amount * 2 : 0;
    if (type === "dozen1") return win >= 1 && win <= 12 ? amount * 3 : 0;
    if (type === "dozen2") return win >= 13 && win <= 24 ? amount * 3 : 0;
    if (type === "dozen3") return win >= 25 && win <= 36 ? amount * 3 : 0;
    return 0;
  }

  const won = result && result.net_payout > totalBet;
  const pushed = result && result.net_payout > 0 && result.net_payout <= totalBet;
  const lost = result && result.net_payout === 0;

  const OUTSIDE_BETS: { type: string; label: string; payout: string; color?: string }[] = [
    { type: "red",    label: "Red",    payout: "1:1", color: "#7f1d1d" },
    { type: "black",  label: "Black",  payout: "1:1", color: "#111" },
    { type: "odd",    label: "Odd",    payout: "1:1" },
    { type: "even",   label: "Even",   payout: "1:1" },
    { type: "low",    label: "1–18",   payout: "1:1" },
    { type: "high",   label: "19–36",  payout: "1:1" },
    { type: "dozen1", label: "1st 12", payout: "2:1" },
    { type: "dozen2", label: "2nd 12", payout: "2:1" },
    { type: "dozen3", label: "3rd 12", payout: "2:1" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Demo toggle + balance */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          Balance:{" "}
          <span style={{ color: "var(--gold)", fontWeight: 600 }}>
            ${balance.toFixed(2)} USDT
          </span>
        </div>
        <button
          onClick={() => { setDemoMode((d) => !d); clearBets(); }}
          style={{
            fontSize: "0.75rem", fontWeight: 500, padding: "4px 10px", borderRadius: 6,
            border: demoMode ? "1px solid #3a6a3a" : "1px solid var(--border-subtle)",
            background: demoMode ? "#0f2a0f" : "transparent",
            color: demoMode ? "#7ecf7e" : "var(--text-dim)",
            cursor: "pointer",
          }}
        >
          {demoMode ? "Demo ON" : "Demo OFF"}
        </button>
      </div>

      {/* Wheel */}
      <RouletteWheel spinning={spinning} winningNumber={animatingNumber} />

      {/* Result banner */}
      <AnimatePresence>
        {result && !spinning && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              border: `1px solid ${won ? "var(--border-gold)" : lost ? "#7f1d1d" : "var(--border-subtle)"}`,
              background: won ? "var(--gold-dim)" : lost ? "rgba(127,29,29,0.15)" : "var(--bg-elevated)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 4 }}>
              <span style={{
                display: "inline-block", width: 28, height: 28, lineHeight: "28px",
                borderRadius: "50%", marginRight: 8, fontSize: "0.875rem",
                background: getColor(result.winning_number) === "green" ? "#065f46"
                  : getColor(result.winning_number) === "red" ? "#7f1d1d" : "#222",
                color: "#e5d5a0",
                textAlign: "center",
              }}>
                {result.winning_number}
              </span>
              <span style={{ color: won ? "var(--gold)" : lost ? "var(--rose)" : "var(--text-primary)" }}>
                {won ? `+$${(result.net_payout - totalBet).toFixed(2)} profit` : pushed ? "Returned" : "Lost"}
              </span>
            </div>
            {result.fee > 0 && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                House fee: ${result.fee.toFixed(2)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History strip */}
      {history.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {history.map((n, i) => (
            <div
              key={i}
              style={{
                width: 26, height: 26, borderRadius: "50%",
                background: getColor(n) === "green" ? "#065f46" : getColor(n) === "red" ? "#7f1d1d" : "#222",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.625rem", fontWeight: 700, color: "#e5d5a0",
              }}
            >
              {n}
            </div>
          ))}
        </div>
      )}

      {/* Bet controls */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 16 }}>
        {/* Chip amount */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 6, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Chip amount
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {PRESET_AMOUNTS.map((p) => (
              <button
                key={p}
                onClick={() => setBetAmount(String(p))}
                style={{
                  flex: 1, padding: "6px 0", borderRadius: 6, fontSize: "0.8125rem", fontWeight: 600,
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
            type="number"
            min={1}
            max={500}
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)",
              background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "0.875rem",
              boxSizing: "border-box",
            }}
            placeholder="Custom amount"
          />
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {(["outside", "numbers"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 6, fontSize: "0.8125rem", fontWeight: 500,
                border: tab === t ? "1px solid var(--gold)" : "1px solid var(--border-subtle)",
                background: tab === t ? "var(--gold-dim)" : "transparent",
                color: tab === t ? "var(--gold)" : "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              {t === "outside" ? "Outside Bets" : "Straight Up"}
            </button>
          ))}
        </div>

        {tab === "outside" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {OUTSIDE_BETS.map(({ type, label, payout, color }) => {
              const active = !!outsideBets[type];
              return (
                <button
                  key={type}
                  onClick={() => toggleOutsideBet(type)}
                  style={{
                    padding: "10px 4px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 600,
                    border: active ? "1px solid var(--gold)" : "1px solid var(--border-subtle)",
                    background: active ? "var(--gold-dim)" : color ?? "var(--bg-elevated)",
                    color: active ? "var(--gold)" : "#e5d5a0",
                    cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                >
                  <span>{label}</span>
                  <span style={{ fontSize: "0.625rem", opacity: 0.7 }}>{payout}</span>
                  {active && <span style={{ fontSize: "0.625rem", color: "var(--gold)" }}>${outsideBets[type]}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <NumberGrid onStraightBet={handleStraightBet} straightBets={straightBets} />
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(127,29,29,0.2)", border: "1px solid #7f1d1d", color: "var(--rose)", fontSize: "0.8125rem" }}>
          {error}
        </div>
      )}

      {/* Total bet summary */}
      {totalBet > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
          <span>Total bet: <strong style={{ color: "var(--text-primary)" }}>${totalBet.toFixed(2)}</strong></span>
          <button
            onClick={clearBets}
            style={{ fontSize: "0.75rem", color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Spin button */}
      <button
        onClick={spin}
        disabled={spinning || totalBet === 0}
        style={{
          padding: "14px 0", borderRadius: 10, fontSize: "1rem", fontWeight: 700,
          fontFamily: "var(--font-display)", letterSpacing: "0.04em",
          cursor: spinning || totalBet === 0 ? "not-allowed" : "pointer",
          border: spinning || totalBet === 0 ? "1px solid var(--border-dim)"
            : demoMode ? "1px solid #3a6a3a" : "none",
          background: spinning || totalBet === 0
            ? "var(--bg-elevated)"
            : demoMode
            ? "linear-gradient(135deg, #1a3a1a, #0f2a0f)"
            : "linear-gradient(135deg, var(--gold-btn-light), var(--gold-btn))",
          color: spinning || totalBet === 0 ? "var(--text-dim)" : demoMode ? "#7ecf7e" : "#070809",
          transition: "background 150ms",
        }}
      >
        {spinning
          ? "Spinning…"
          : totalBet === 0
          ? "Place a bet to spin"
          : demoMode
          ? `Demo Spin — $${totalBet.toFixed(2)}`
          : `🎰 Spin — $${totalBet.toFixed(2)}`}
      </button>

      {/* Rules */}
      <div style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border-dim)", background: "var(--bg-surface)" }}>
        <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", lineHeight: 1.65 }}>
          <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>How to play</strong>
          European single-zero wheel (0–36). Place outside bets (Red/Black, Odd/Even, 1–18/19–36, Dozens) or bet straight up on any number for 35:1.
          Zero wins only for straight bets on 0. 2% fee on profits only.
        </div>
      </div>
    </div>
  );
}
