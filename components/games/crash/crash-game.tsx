"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type GameState = "idle" | "flying" | "cashed_out" | "crashed";

interface RoundResult {
  crashed_at: number;
  cashout_at: number | null;
  won: boolean;
  net_payout: number;
  new_balance: number | null;
}

interface HistoryEntry {
  crashed_at: number;
  won: boolean;
  cashout_at: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PRESETS = [1.5, 2, 3, 5, 10, 25];
const SPEED   = 0.00072; // ln-growth per ms → ~2x at 963ms, ~10x at 3203ms

function multAt(ms: number) {
  return Math.exp(SPEED * ms);
}

function msFor(mult: number) {
  return Math.log(mult) / SPEED;
}

function multColor(m: number) {
  if (m < 2)   return "#22c55e";
  if (m < 5)   return "#eab308";
  if (m < 10)  return "#f97316";
  return "#ef4444";
}

// ---------------------------------------------------------------------------
// Rocket SVG
// ---------------------------------------------------------------------------
function Rocket({ crashed }: { crashed: boolean }) {
  return (
    <svg width="42" height="56" viewBox="0 0 42 56" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: crashed ? "drop-shadow(0 0 12px #ef4444)" : "drop-shadow(0 0 8px #38bdf8)", transition: "filter 0.2s" }}>
      {/* Body */}
      <path d="M21 2 C12 10 8 22 8 34 L21 40 L34 34 C34 22 30 10 21 2Z"
        fill={crashed ? "#7f1d1d" : "#e0f2fe"} stroke={crashed ? "#ef4444" : "#38bdf8"} strokeWidth="1.5"/>
      {/* Window */}
      <circle cx="21" cy="22" r="5" fill={crashed ? "#450a0a" : "#0ea5e9"} stroke={crashed ? "#ef4444" : "#7dd3fc"} strokeWidth="1"/>
      {/* Left fin */}
      <path d="M8 34 L2 48 L12 42 Z" fill={crashed ? "#7f1d1d" : "#bae6fd"} stroke={crashed ? "#ef4444" : "#38bdf8"} strokeWidth="1"/>
      {/* Right fin */}
      <path d="M34 34 L40 48 L30 42 Z" fill={crashed ? "#7f1d1d" : "#bae6fd"} stroke={crashed ? "#ef4444" : "#38bdf8"} strokeWidth="1"/>
      {/* Flame */}
      {!crashed && (
        <motion.path
          d="M15 40 Q21 56 27 40 Q21 48 15 40Z"
          fill="#f97316"
          animate={{ scaleY: [1, 1.3, 0.8, 1.2, 1], opacity: [1, 0.9, 1, 0.8, 1] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />
      )}
      {crashed && (
        <>
          <motion.circle cx="21" cy="28" r="18"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.6 }}
            fill="#ef4444"/>
          <motion.circle cx="21" cy="28" r="10"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            fill="#f97316"/>
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Graph curve component
// ---------------------------------------------------------------------------
function CrashGraph({ progress, mult, crashed }: { progress: number; mult: number; crashed: boolean }) {
  const W = 500, H = 280;
  const pad = { l: 44, r: 20, t: 20, b: 36 };
  const gW = W - pad.l - pad.r;
  const gH = H - pad.t - pad.b;

  // Build SVG path: exponential curve up to current progress
  const steps = 60;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * progress;
    const m = Math.exp(SPEED * t * 8000);
    const x = pad.l + (i / steps) * gW;
    const y = pad.t + gH - Math.min(1, Math.log(m) / Math.log(Math.max(mult, 1.5))) * gH;
    pts.push([x, y]);
  }

  const linePath = pts.length > 1
    ? "M " + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")
    : "";

  const fillPath = linePath
    ? linePath + ` L ${pts[pts.length - 1][0].toFixed(1)},${(pad.t + gH).toFixed(1)} L ${pad.l},${(pad.t + gH).toFixed(1)} Z`
    : "";

  const rocketX = pts.length > 0 ? pts[pts.length - 1][0] : pad.l;
  const rocketY = pts.length > 0 ? pts[pts.length - 1][1] : pad.t + gH;

  const lineColor = crashed ? "#ef4444" : "#22c55e";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }}>
      {/* Grid lines */}
      {[1, 2, 5, 10].map((m) => {
        const y = pad.t + gH - Math.min(1, Math.log(m) / Math.log(Math.max(mult, 1.5))) * gH;
        if (y < pad.t || y > pad.t + gH) return null;
        return (
          <g key={m}>
            <line x1={pad.l} y1={y} x2={pad.l + gW} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4"/>
            <text x={pad.l - 6} y={y + 4} fill="rgba(255,255,255,0.3)"
              fontSize="10" textAnchor="end" fontFamily="monospace">{m}×</text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + gH} stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <line x1={pad.l} y1={pad.t + gH} x2={pad.l + gW} y2={pad.t + gH} stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>

      {/* Fill */}
      {fillPath && (
        <path d={fillPath} fill={crashed ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.07)"}/>
      )}

      {/* Line */}
      {linePath && (
        <path d={linePath} stroke={lineColor} strokeWidth="2.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round"/>
      )}

      {/* Rocket */}
      {progress > 0 && (
        <foreignObject x={rocketX - 21} y={rocketY - 52} width="42" height="56">
          <Rocket crashed={crashed}/>
        </foreignObject>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface Props {
  initialBalance: string;
}

export function CrashGame({ initialBalance }: Props) {
  const [balance, setBalance]         = useState(parseFloat(initialBalance) || 0);
  const [betAmount, setBetAmount]     = useState("10");
  const [autoCashout, setAutoCashout] = useState("2.00");
  const [gameState, setGameState]     = useState<GameState>("idle");
  const [currentMult, setCurrentMult] = useState(1.0);
  const [progress, setProgress]       = useState(0);
  const [result, setResult]           = useState<RoundResult | null>(null);
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [error, setError]             = useState<string | null>(null);
  const [demoMode, setDemoMode]       = useState(false);

  const rafRef   = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const targetRef = useRef<{ crashAt: number; cashoutAt: number | null }>(
    { crashAt: 2, cashoutAt: null }
  );

  // Animate multiplier from 1x upward until target
  const startAnimation = useCallback((crashAt: number, cashoutAt: number | null) => {
    targetRef.current = { crashAt, cashoutAt };
    startRef.current  = performance.now();
    setCurrentMult(1.0);
    setProgress(0);

    const stopAt = cashoutAt ?? crashAt;
    const totalMs = msFor(stopAt);

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / totalMs, 1);
      const m = multAt(elapsed);

      setCurrentMult(Math.min(m, stopAt));
      setProgress(t);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Animation complete — show result
        setCurrentMult(stopAt);
        setProgress(1);
        if (cashoutAt !== null) {
          setGameState("cashed_out");
        } else {
          setGameState("crashed");
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const play = useCallback(async () => {
    const bet  = parseFloat(betAmount);
    const cash = parseFloat(autoCashout);

    if (isNaN(bet) || bet < 1)     { setError("Minimum bet is $1."); return; }
    if (isNaN(cash) || cash < 1.01) { setError("Minimum cashout is 1.01×."); return; }
    if (!demoMode && bet > balance) { setError("Insufficient balance."); return; }

    setError(null);
    setResult(null);
    setGameState("flying");

    if (demoMode) {
      // Client-side fake round
      const u = Math.random();
      const crashAt = u < 0.01 ? 1.00 : Math.max(1.00, Math.floor(100 * 0.99 / (1 - u)) / 100);
      const won      = crashAt >= cash;
      const cashoutAt = won ? cash : null;
      const fakeResult: RoundResult = {
        crashed_at: crashAt,
        cashout_at: cashoutAt,
        won,
        net_payout: won ? bet * cash : 0,
        new_balance: null,
      };
      startAnimation(crashAt, cashoutAt);
      setTimeout(() => {
        setResult(fakeResult);
        setHistory((h) => [{ crashed_at: crashAt, won, cashout_at: cashoutAt }, ...h].slice(0, 15));
      }, msFor(cashoutAt ?? crashAt) + 200);
      return;
    }

    try {
      const res  = await fetch("/api/games/crash/play", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet_amount: bet, auto_cashout: cash }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message ?? "Play failed.");
        setGameState("idle");
        return;
      }

      const r: RoundResult = data;
      startAnimation(r.crashed_at, r.cashout_at);

      // Show result after animation finishes
      const animMs = msFor((r.cashout_at ?? r.crashed_at));
      setTimeout(() => {
        setResult(r);
        if (r.new_balance !== null) setBalance(r.new_balance);
        setHistory((h) => [
          { crashed_at: r.crashed_at, won: r.won, cashout_at: r.cashout_at },
          ...h,
        ].slice(0, 15));
      }, animMs + 200);
    } catch {
      setError("Network error. Please try again.");
      setGameState("idle");
    }
  }, [betAmount, autoCashout, balance, demoMode, startAnimation]);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setGameState("idle");
    setCurrentMult(1.0);
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  const isFlying  = gameState === "flying";
  const isCrashed = gameState === "crashed";
  const isCashedOut = gameState === "cashed_out";
  const isDone    = isCrashed || isCashedOut;

  const multStr = currentMult.toFixed(2) + "×";
  const cashoutNum = parseFloat(autoCashout) || 2;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 10 }}>
        {/* Balance */}
        <div style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-elevated)" }}>
          <div style={{ fontSize: "0.625rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Balance</div>
          <div style={{ fontSize: "1.0625rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {demoMode ? "—" : `$${balance.toFixed(2)}`}
          </div>
        </div>

        {/* Last crash */}
        {result && (
          <div style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${result.won ? "var(--teal)" : "var(--rose)"}40`, backgroundColor: result.won ? "rgba(13,184,145,0.06)" : "rgba(239,68,68,0.06)" }}>
            <div style={{ fontSize: "0.625rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {result.won ? "Cashed out" : "Crashed at"}
            </div>
            <div style={{ fontSize: "1.0625rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: result.won ? "var(--teal)" : "var(--rose)", fontVariantNumeric: "tabular-nums" }}>
              {result.won ? `${result.cashout_at?.toFixed(2)}×` : `${result.crashed_at.toFixed(2)}×`}
            </div>
          </div>
        )}

        {/* Demo toggle */}
        <button
          onClick={() => { setDemoMode((v) => !v); reset(); }}
          style={{ padding: "8px 14px", borderRadius: 10, border: demoMode ? "1px solid var(--gold)" : "1px solid var(--border-dim)", backgroundColor: demoMode ? "var(--gold-dim)" : "transparent", color: demoMode ? "var(--gold)" : "var(--text-dim)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
          {demoMode ? "Demo ON" : "Demo"}
        </button>
      </div>

      {/* Graph / multiplier display */}
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "radial-gradient(ellipse at 30% 70%, #0a1628 0%, #050d1a 60%, #020710 100%)", border: "1px solid rgba(255,255,255,0.06)", aspectRatio: "16/9" }}>

        {/* Stars */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} style={{
              position: "absolute",
              width: i % 5 === 0 ? 2 : 1,
              height: i % 5 === 0 ? 2 : 1,
              borderRadius: "50%",
              background: "white",
              opacity: 0.2 + (i % 5) * 0.1,
              left: `${(i * 37 + 13) % 100}%`,
              top: `${(i * 53 + 7) % 100}%`,
            }}/>
          ))}
        </div>

        {/* Graph */}
        <div style={{ position: "absolute", inset: 0 }}>
          <CrashGraph progress={progress} mult={Math.max(currentMult, cashoutNum, 2)} crashed={isCrashed}/>
        </div>

        {/* Big multiplier */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center", pointerEvents: "none",
        }}>
          <AnimatePresence mode="wait">
            {gameState === "idle" && !isDone && (
              <motion.div key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: "2rem", fontWeight: 800, color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>
                Place bet to fly
              </motion.div>
            )}
            {isFlying && (
              <motion.div key="flying"
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <div style={{ fontSize: "3.5rem", fontWeight: 900, fontFamily: "var(--font-mono)", color: multColor(currentMult), letterSpacing: "-0.03em", textShadow: `0 0 30px ${multColor(currentMult)}80`, lineHeight: 1 }}>
                  {multStr}
                </div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginTop: 6, fontFamily: "var(--font-mono)" }}>
                  target {cashoutNum.toFixed(2)}×
                </div>
              </motion.div>
            )}
            {isCashedOut && result && (
              <motion.div key="won"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--teal)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>CASHED OUT ✓</div>
                <div style={{ fontSize: "3rem", fontWeight: 900, fontFamily: "var(--font-mono)", color: "var(--teal)", letterSpacing: "-0.03em", textShadow: "0 0 30px rgba(13,184,145,0.6)", lineHeight: 1 }}>
                  {result.cashout_at?.toFixed(2)}×
                </div>
                {!demoMode && (
                  <div style={{ fontSize: "0.875rem", color: "var(--teal)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
                    +${(result.net_payout - parseFloat(betAmount)).toFixed(2)} profit
                  </div>
                )}
              </motion.div>
            )}
            {isCrashed && result && (
              <motion.div key="lost"
                initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--rose)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>CRASHED</div>
                <div style={{ fontSize: "3rem", fontWeight: 900, fontFamily: "var(--font-mono)", color: "var(--rose)", letterSpacing: "-0.03em", textShadow: "0 0 30px rgba(239,68,68,0.6)", lineHeight: 1 }}>
                  {result.crashed_at.toFixed(2)}×
                </div>
                {!demoMode && (
                  <div style={{ fontSize: "0.875rem", color: "var(--rose)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
                    −${parseFloat(betAmount).toFixed(2)} lost
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* History strip */}
      {history.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {history.map((h, i) => (
            <div key={i} style={{
              padding: "3px 9px", borderRadius: 20,
              backgroundColor: h.won ? "rgba(13,184,145,0.12)" : "rgba(239,68,68,0.12)",
              border: `1px solid ${h.won ? "rgba(13,184,145,0.3)" : "rgba(239,68,68,0.3)"}`,
              fontSize: "0.6875rem", fontWeight: 600, fontFamily: "var(--font-mono)",
              color: h.won ? "var(--teal)" : "var(--rose)",
            }}>
              {h.crashed_at.toFixed(2)}×
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Bet amount */}
        <div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Bet amount</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: "0.875rem", pointerEvents: "none" }}>$</span>
              <input
                type="number" min="1" max="500" step="1"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={isFlying}
                style={{ width: "100%", padding: "10px 12px 10px 26px", borderRadius: 8, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "0.9375rem", fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {[5, 10, 25, 50, 100].map((v) => (
              <button key={v} onClick={() => setBetAmount(String(v))} disabled={isFlying}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-dim)", backgroundColor: betAmount === String(v) ? "var(--bg-elevated)" : "transparent", color: betAmount === String(v) ? "var(--text-primary)" : "var(--text-dim)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                ${v}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-cashout */}
        <div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Auto cash-out at</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                type="number" min="1.01" max="100" step="0.01"
                value={autoCashout}
                onChange={(e) => setAutoCashout(e.target.value)}
                disabled={isFlying}
                style={{ width: "100%", padding: "10px 28px 10px 12px", borderRadius: 8, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "0.9375rem", fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box" }}
              />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: "0.875rem", pointerEvents: "none" }}>×</span>
            </div>
            {PRESETS.map((v) => (
              <button key={v} onClick={() => setAutoCashout(v.toFixed(2))} disabled={isFlying}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-dim)", backgroundColor: autoCashout === v.toFixed(2) ? "var(--bg-elevated)" : "transparent", color: autoCashout === v.toFixed(2) ? "var(--text-primary)" : "var(--text-dim)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                {v}×
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--rose)", fontSize: "0.8125rem" }}>
            {error}
          </div>
        )}

        {/* Action button */}
        {!isDone ? (
          <button
            onClick={play}
            disabled={isFlying}
            style={{
              padding: "13px 0", borderRadius: 10, border: "none", cursor: isFlying ? "not-allowed" : "pointer",
              background: isFlying
                ? "var(--bg-elevated)"
                : demoMode
                  ? "linear-gradient(135deg, #1a3a1a, #0f2a0f)"
                  : "linear-gradient(135deg, var(--gold-btn-light), var(--gold-btn))",
              color: isFlying ? "var(--text-dim)" : demoMode ? "#7ecf7e" : "#070809",
              fontSize: "1rem", fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "0.04em",
              transition: "background 150ms",
              border: isFlying ? "1px solid var(--border-dim)" : demoMode ? "1px solid #3a6a3a" : "none",
            }}>
            {isFlying ? "🚀 Flying…" : demoMode ? "Demo Launch (free)" : `🚀 Launch — $${parseFloat(betAmount || "0").toFixed(2)}`}
          </button>
        ) : (
          <button
            onClick={reset}
            style={{ padding: "13px 0", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-dim)", color: "var(--text-primary)", fontSize: "1rem", fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: "0.04em", cursor: "pointer" }}>
            Play Again
          </button>
        )}
      </div>

      {/* Rules */}
      <div style={{ padding: "11px 14px", borderRadius: 8, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)" }}>
        <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", lineHeight: 1.65 }}>
          <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: 3 }}>How to play</strong>
          Set your bet and a target multiplier. The rocket launches and the multiplier climbs — if it reaches your target before crashing, you win. 2% fee on profits.
        </div>
      </div>
    </div>
  );
}
