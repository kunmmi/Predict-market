"use client";

import { useState, useCallback } from "react";
import { Die } from "./dice";

type Phase = "come_out" | "point";
type BetType = "pass_line" | "dont_pass" | "field";
type Outcome = "win" | "loss" | "push" | "point_set" | "point_hit" | "seven_out" | "continue";

interface RollResult {
  die1: number;
  die2: number;
  total: number;
  outcome: Outcome;
  point_number: number | null;
  net_payout: number;
  gross_payout: number;
  fee: number;
  new_balance: string | null;
}

interface Props {
  initialBalance: string;
}

const CHIP_PRESETS = [1, 5, 10, 25, 50, 100];

const BET_LABELS: Record<BetType, { name: string; desc: string; color: string }> = {
  pass_line: {
    name: "Pass Line",
    desc: "Win on 7/11. Lose on 2/3. Pays 1:1",
    color: "var(--teal)",
  },
  dont_pass: {
    name: "Don't Pass",
    desc: "Win on 2/3. Lose on 7/11. Pays 1:1",
    color: "var(--rose)",
  },
  field: {
    name: "Field",
    desc: "2→2:1  12→3:1  3,4,9,10,11→1:1",
    color: "var(--gold)",
  },
};

function OutcomeBanner({ outcome, netPayout, total }: { outcome: Outcome; netPayout: number; total: number }) {
  const config: Record<Outcome, { label: string; sub: string; color: string }> = {
    win:       { label: "Winner!", sub: `+$${netPayout.toFixed(2)}`, color: "var(--teal)" },
    point_hit: { label: "Point Hit!", sub: `+$${netPayout.toFixed(2)}`, color: "var(--teal)" },
    loss:      { label: "No dice", sub: "Better luck next time", color: "var(--rose)" },
    seven_out: { label: "Seven Out", sub: "The point is gone", color: "var(--rose)" },
    push:      { label: "Push", sub: "Bet returned", color: "var(--text-secondary)" },
    point_set: { label: `Point is ${total}`, sub: "Roll again to hit it", color: "var(--gold)" },
    continue:  { label: `Rolled ${total}`, sub: "Keep rolling", color: "var(--text-secondary)" },
  };
  const c = config[outcome];
  return (
    <div
      style={{
        textAlign: "center",
        padding: "14px 20px",
        borderRadius: 10,
        border: `1px solid ${c.color}40`,
        backgroundColor: `${c.color}12`,
      }}
    >
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: c.color, fontFamily: "var(--font-display)" }}>
        {c.label}
      </div>
      <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: 2 }}>{c.sub}</div>
    </div>
  );
}

export function CrapsTable({ initialBalance }: Props) {
  const [phase, setPhase] = useState<Phase>("come_out");
  const [point, setPoint] = useState<number | null>(null);
  const [bets, setBets] = useState<Partial<Record<BetType, number>>>({});
  const [selectedChip, setSelectedChip] = useState(5);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const [balance, setBalance] = useState(parseFloat(initialBalance) || 0);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const totalBet = Object.values(bets).reduce((s, v) => s + (v ?? 0), 0);

  const placeBet = useCallback((type: BetType) => {
    setBets((prev) => {
      const current = prev[type] ?? 0;
      const next = current + selectedChip;
      if (next > 500) return prev;
      return { ...prev, [type]: next };
    });
  }, [selectedChip]);

  const clearBets = useCallback(() => setBets({}), []);

  const roll = useCallback(async () => {
    if (totalBet <= 0 || rolling) return;
    if (balance < totalBet) {
      setError("Insufficient balance.");
      return;
    }
    setError(null);
    setRolling(true);

    const betArray = (Object.entries(bets) as [BetType, number][])
      .filter(([, amt]) => amt > 0)
      .map(([type, amount]) => ({ type, amount }));

    const res = await fetch("/api/games/craps/roll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bets: betArray, phase, point_number: point }),
    });

    const data = (await res.json()) as { success: boolean; message?: string } & Partial<RollResult>;

    // Keep dice rolling for a moment for visual effect
    await new Promise((r) => setTimeout(r, 700));
    setRolling(false);

    if (!res.ok || !data.success) {
      setError(data.message ?? "Roll failed. Please try again.");
      return;
    }

    const result = data as RollResult;
    setLastRoll(result);

    if (result.new_balance !== null) {
      setBalance(parseFloat(result.new_balance ?? "0"));
    }

    const outcome = result.outcome;

    if (outcome === "point_set") {
      setPhase("point");
      setPoint(result.point_number);
      // Keep bets for the point phase
    } else if (outcome === "point_hit" || outcome === "seven_out") {
      setPhase("come_out");
      setPoint(null);
      setBets({});
    } else if (outcome === "win" || outcome === "loss" || outcome === "push") {
      setPhase("come_out");
      setPoint(null);
      setBets({});
    }
    // 'continue' → keep everything the same
  }, [bets, phase, point, rolling, totalBet, balance]);

  const demoRoll = useCallback(async () => {
    if (rolling) return;
    setError(null);
    setRolling(true);
    await new Promise((r) => setTimeout(r, 700));

    const die1 = Math.ceil(Math.random() * 6);
    const die2 = Math.ceil(Math.random() * 6);
    const total = die1 + die2;

    let outcome: Outcome;
    let newPoint: number | null = null;

    if (phase === "come_out") {
      if (total === 7 || total === 11) outcome = "win";
      else if (total === 2 || total === 3) outcome = "loss";
      else if (total === 12) outcome = "push";
      else { outcome = "point_set"; newPoint = total; }
    } else {
      if (total === point) outcome = "point_hit";
      else if (total === 7) outcome = "seven_out";
      else outcome = "continue";
    }

    setRolling(false);
    setLastRoll({ die1, die2, total, outcome, point_number: newPoint, net_payout: 0, gross_payout: 0, fee: 0, new_balance: null });

    if (outcome === "point_set") { setPhase("point"); setPoint(newPoint); }
    else if (["point_hit", "seven_out", "win", "loss", "push"].includes(outcome)) { setPhase("come_out"); setPoint(null); }
  }, [rolling, phase, point]);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Demo mode toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <button
          onClick={() => { setDemoMode((v) => !v); setLastRoll(null); setPhase("come_out"); setPoint(null); setBets({}); setError(null); }}
          style={{
            fontSize: "0.75rem", fontWeight: 500,
            padding: "4px 12px", borderRadius: 20,
            border: demoMode ? "1px solid var(--gold)" : "1px solid var(--border-dim)",
            backgroundColor: demoMode ? "var(--gold-dim)" : "transparent",
            color: demoMode ? "var(--gold)" : "var(--text-dim)",
            cursor: "pointer", transition: "all 150ms ease",
          }}
        >
          {demoMode ? "Demo mode ON — no real money" : "Try demo (no money)"}
        </button>
      </div>

      {/* Balance + Phase bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderRadius: 10,
          border: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-elevated)",
        }}
      >
        <div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Balance</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            ${balance.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Phase</div>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: phase === "come_out" ? "var(--teal)" : "var(--gold)",
            }}
          >
            {phase === "come_out" ? "Come-Out Roll" : `Point: ${point}`}
          </div>
        </div>
      </div>

      {/* Dice area */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          padding: "36px 20px 44px",
          borderRadius: 14,
          background: "radial-gradient(ellipse at 50% 30%, #0f3318 0%, #0a2410 55%, #061508 100%)",
          border: "2px solid #1e5428",
          boxShadow: "inset 0 2px 20px rgba(0,0,0,0.6), 0 4px 24px rgba(0,0,0,0.5)",
          position: "relative",
          overflow: "hidden",
          minHeight: 160,
        }}
      >
        {/* Felt diamond weave */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.07,
          backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)",
          backgroundSize: "12px 12px",
          pointerEvents: "none",
        }} />
        {/* Inner glow rim */}
        <div style={{
          position: "absolute", inset: 0,
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.5)",
          borderRadius: 12,
          pointerEvents: "none",
        }} />

        {lastRoll ? (
          <>
            <Die value={lastRoll.die1} rolling={rolling} delay={0} />
            <Die value={lastRoll.die2} rolling={rolling} delay={60} />
            {!rolling && (
              <div style={{
                position: "absolute", right: 18, bottom: 12,
                fontSize: "2.5rem", fontWeight: 800,
                color: "rgba(255,255,255,0.08)",
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                userSelect: "none",
              }}>
                {lastRoll.total}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.875rem", zIndex: 1, textAlign: "center" }}>
            {demoMode ? "Hit Demo Roll to see the dice" : "Place your bets and roll"}
          </div>
        )}
      </div>

      {/* Outcome banner */}
      {lastRoll && !rolling && (
        <OutcomeBanner outcome={lastRoll.outcome} netPayout={lastRoll.net_payout} total={lastRoll.total} />
      )}

      {/* Bet areas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(Object.entries(BET_LABELS) as [BetType, typeof BET_LABELS[BetType]][]).map(([type, meta]) => {
          const betAmount = bets[type] ?? 0;
          const locked = phase === "point" && (type === "pass_line" || type === "dont_pass");

          return (
            <button
              key={type}
              onClick={() => !locked && placeBet(type)}
              disabled={locked || rolling}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                border: betAmount > 0 ? `1px solid ${meta.color}60` : "1px solid var(--border-dim)",
                backgroundColor: betAmount > 0 ? `${meta.color}10` : "var(--bg-elevated)",
                cursor: locked || rolling ? "not-allowed" : "pointer",
                opacity: locked ? 0.45 : 1,
                textAlign: "left",
                transition: "border-color 150ms, background-color 150ms",
                width: "100%",
              }}
            >
              {/* Chip indicator */}
              <div
                style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  border: `3px solid ${betAmount > 0 ? meta.color : "var(--border-subtle)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.625rem", fontWeight: 700,
                  color: betAmount > 0 ? meta.color : "var(--text-dim)",
                  fontFamily: "var(--font-mono)",
                  transition: "border-color 150ms, color 150ms",
                }}
              >
                {betAmount > 0 ? `$${betAmount}` : "+"}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: betAmount > 0 ? meta.color : "var(--text-primary)" }}>
                  {meta.name}
                  {locked && <span style={{ marginLeft: 6, fontSize: "0.6875rem", color: "var(--text-dim)" }}>(locked in)</span>}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginTop: 1 }}>{meta.desc}</div>
              </div>

              {betAmount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setBets((p) => { const n = { ...p }; delete n[type]; return n; }); }}
                  style={{
                    fontSize: "0.75rem", color: "var(--text-dim)", background: "none", border: "none",
                    cursor: "pointer", padding: "2px 6px", borderRadius: 4,
                  }}
                >
                  ✕
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Chip selector */}
      <div>
        <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Chip size — click a bet to place
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CHIP_PRESETS.map((val) => (
            <button
              key={val}
              onClick={() => setSelectedChip(val)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                border: selectedChip === val ? "1px solid var(--gold)" : "1px solid var(--border-dim)",
                backgroundColor: selectedChip === val ? "var(--gold-dim)" : "var(--bg-elevated)",
                color: selectedChip === val ? "var(--gold)" : "var(--text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: selectedChip === val ? 600 : 400,
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              ${val}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--rose)", backgroundColor: "rgba(239,68,68,0.08)", fontSize: "0.8125rem", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        {!demoMode && (
          <button
            onClick={clearBets}
            disabled={rolling || totalBet === 0}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 10,
              border: "1px solid var(--border-dim)",
              backgroundColor: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              fontSize: "0.875rem", fontWeight: 500,
              cursor: totalBet === 0 || rolling ? "not-allowed" : "pointer",
              opacity: totalBet === 0 || rolling ? 0.4 : 1,
              transition: "opacity 150ms",
            }}
          >
            Clear
          </button>
        )}

        <button
          onClick={demoMode ? demoRoll : roll}
          disabled={rolling || (!demoMode && totalBet === 0)}
          style={{
            flex: 3, padding: "12px 0", borderRadius: 10,
            background: (demoMode || totalBet > 0) && !rolling
              ? demoMode
                ? "linear-gradient(135deg, #2a4a2a 0%, #1a3a1a 100%)"
                : "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)"
              : "var(--bg-elevated)",
            border: demoMode ? "1px solid #3a6a3a" : "1px solid transparent",
            color: (demoMode || totalBet > 0) && !rolling
              ? demoMode ? "#7ecf7e" : "#070809"
              : "var(--text-dim)",
            fontSize: "0.9375rem", fontWeight: 700,
            cursor: rolling || (!demoMode && totalBet === 0) ? "not-allowed" : "pointer",
            transition: "background 150ms, color 150ms",
            fontFamily: "var(--font-display)",
            letterSpacing: "0.04em",
          }}
        >
          {rolling
            ? "Rolling…"
            : demoMode
            ? "Demo Roll (free)"
            : totalBet > 0
            ? `Roll — $${totalBet.toFixed(2)}`
            : "Place a bet first"}
        </button>
      </div>

      {/* Rules callout */}
      <div style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)" }}>
        <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>How to play</strong>
          Come-out: 7 or 11 wins (Pass) · 2 or 3 loses · 12 pushes · 4-6/8-10 sets the point.
          Point phase: hit the point to win, roll 7 to lose. Field bets resolve every roll.
          <span style={{ display: "block", marginTop: 4, color: "var(--text-dim)" }}>2% fee on net winnings only. Min $1 · Max $500 per bet.</span>
        </div>
      </div>

      <style>{`
        @keyframes dieShake {
          0% { transform: translate(-2px, -2px) rotate(-3deg); }
          100% { transform: translate(2px, 2px) rotate(3deg); }
        }
      `}</style>
    </div>
  );
}
