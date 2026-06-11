"use client";

import { useState } from "react";
import { ChevronRight, CheckCircle, AlertCircle } from "lucide-react";

import type { MarketOutcomeItem } from "@/lib/services/market-data";
import type { Locale } from "@/lib/i18n/translations";

type Props = {
  marketId: string;
  outcomes: MarketOutcomeItem[];
  locale: Locale;
  walletBalance: number;
};

const FEE_RATE = 0.05;
const MIN_STAKE = 1;
const MAX_STAKE = 500;

export function MultiTradeForm({ marketId, outcomes, locale, walletBalance }: Props) {
  const zh = locale === "zh";
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [amount, setAmount]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [localOutcomes, setLocalOutcomes] = useState<MarketOutcomeItem[]>(outcomes);

  const selected = localOutcomes.find((o) => o.id === selectedOutcomeId) ?? null;
  const stakeNum = parseFloat(amount) || 0;
  const feeNum   = parseFloat((stakeNum * FEE_RATE).toFixed(2));
  const totalNum = parseFloat((stakeNum + feeNum).toFixed(2));

  // Estimate payout: (stake / (winner_pool + stake)) * (total_pool + stake) * (1 - fee)
  const totalPool   = localOutcomes.reduce((s, o) => s + o.poolAmount, 0);
  const winnerPool  = selected ? selected.poolAmount : 0;
  const estPayout   = stakeNum > 0 && selected
    ? parseFloat((
        (stakeNum / (winnerPool + stakeNum)) * (totalPool + stakeNum) * (1 - FEE_RATE)
      ).toFixed(2))
    : 0;
  const estProfit   = parseFloat((estPayout - stakeNum).toFixed(2));
  const estMultiple = stakeNum > 0 ? parseFloat((estPayout / stakeNum).toFixed(2)) : 0;

  async function handleTrade() {
    if (!selected || stakeNum < MIN_STAKE) return;
    if (stakeNum > MAX_STAKE) { setError(zh ? `最大投注为 $${MAX_STAKE}` : `Maximum stake is $${MAX_STAKE}`); return; }
    if (totalNum > walletBalance) { setError(zh ? "余额不足" : "Insufficient balance"); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/trades/multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_id: marketId, outcome_id: selected.id, amount: String(stakeNum) }),
      });
      const json = await res.json() as { success: boolean; message?: string };

      if (!res.ok || !json.success) {
        setError(json.message ?? (zh ? "交易失败" : "Trade failed"));
        return;
      }

      // Update local pool optimistically
      setLocalOutcomes((prev) => {
        const newPool = prev.map((o) =>
          o.id === selected.id ? { ...o, poolAmount: o.poolAmount + stakeNum } : o
        );
        const total = newPool.reduce((s, o) => s + o.poolAmount, 0);
        return newPool.map((o) => ({ ...o, price: total > 0 ? o.poolAmount / total : 1 / newPool.length }));
      });

      setSuccess(true);
      setAmount("");
    } catch {
      setError(zh ? "网络错误，请重试" : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        padding: "2rem 1rem", textAlign: "center",
        backgroundColor: "var(--bg-surface)", border: "1px solid rgba(13,184,145,0.2)",
        borderRadius: "var(--radius-lg)",
      }}>
        <CheckCircle style={{ width: 36, height: 36, color: "var(--teal)" }} />
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
          {zh ? "投注成功！" : "Trade placed!"}
        </p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          {zh ? `您支持了 "${selected ? ((zh && selected.labelZh) ? selected.labelZh : selected.label) : ""}"` : `You backed "${selected ? selected.label : ""}"`}
        </p>
        <button
          onClick={() => { setSuccess(false); setSelectedOutcomeId(null); }}
          style={{
            marginTop: 4, padding: "8px 20px",
            fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 600,
            color: "var(--gold)", backgroundColor: "rgba(232,160,32,0.08)",
            border: "1px solid rgba(232,160,32,0.2)", borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          {zh ? "再投一次" : "Trade again"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Outcome selector */}
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
          {zh ? "选择结果" : "SELECT OUTCOME"}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
          {localOutcomes.map((o, i) => {
            const label = (zh && o.labelZh) ? o.labelZh : o.label;
            const pct   = Math.round(o.price * 100);
            const active = selectedOutcomeId === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setSelectedOutcomeId(o.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: active ? "rgba(232,160,32,0.08)" : "var(--bg-elevated)",
                  border: `1px solid ${active ? "rgba(232,160,32,0.35)" : "var(--border-subtle)"}`,
                  cursor: "pointer", textAlign: "left",
                  transition: "border-color 120ms ease, background-color 120ms ease",
                }}
              >
                <span style={{
                  width: 20, height: 20, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700,
                  color: active ? "var(--gold)" : i === 0 ? "var(--gold)" : "var(--text-dim)",
                  backgroundColor: active ? "rgba(232,160,32,0.15)" : i === 0 ? "rgba(232,160,32,0.08)" : "rgba(255,255,255,0.04)",
                  borderRadius: "50%",
                  border: `1px solid ${active ? "rgba(232,160,32,0.4)" : i === 0 ? "rgba(232,160,32,0.2)" : "rgba(255,255,255,0.06)"}`,
                }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: active ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: "var(--bg-surface)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", backgroundColor: active ? "var(--gold)" : "rgba(255,255,255,0.2)" }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", fontWeight: 700, color: active ? "var(--gold)" : "var(--text-dim)", width: 28, textAlign: "right" }}>
                    {pct}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Amount input */}
      {selectedOutcomeId && (
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.5rem" }}>
            {zh ? "投注金额 (USDT)" : "STAKE (USDT)"}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--text-dim)" }}>$</span>
              <input
                type="number"
                min={MIN_STAKE}
                max={MAX_STAKE}
                step="1"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(null); }}
                placeholder="10"
                style={{
                  width: "100%", paddingLeft: 22, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 600,
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)", outline: "none",
                }}
                className="focus:border-[var(--gold)]"
              />
            </div>
            {/* Quick amounts */}
            {[5, 10, 25, 50].map((n) => (
              <button
                key={n}
                onClick={() => { setAmount(String(n)); setError(null); }}
                style={{
                  padding: "8px 10px",
                  fontFamily: "var(--font-mono)", fontSize: "0.625rem", fontWeight: 700,
                  color: amount === String(n) ? "var(--gold)" : "var(--text-dim)",
                  backgroundColor: amount === String(n) ? "rgba(232,160,32,0.08)" : "var(--bg-elevated)",
                  border: `1px solid ${amount === String(n) ? "rgba(232,160,32,0.3)" : "var(--border-subtle)"}`,
                  borderRadius: "var(--radius-sm)", cursor: "pointer",
                }}
              >
                ${n}
              </button>
            ))}
          </div>

          {/* Payout estimate */}
          {stakeNum >= MIN_STAKE && (
            <div style={{
              marginTop: "0.75rem", padding: "10px 12px",
              backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
            }}>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>{zh ? "总支出" : "TOTAL COST"}</p>
                <p style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>${totalNum.toFixed(2)}</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "var(--text-dim)" }}>{zh ? `含 $${feeNum.toFixed(2)} 手续费` : `incl. $${feeNum.toFixed(2)} fee`}</p>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>{zh ? "预计回报" : "EST. PAYOUT"}</p>
                <p style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "var(--teal)" }}>${estPayout.toFixed(2)}</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "var(--text-dim)" }}>{estMultiple}x</p>
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-dim)" }}>{zh ? "预计利润" : "EST. PROFIT"}</p>
                <p style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: estProfit >= 0 ? "var(--teal)" : "var(--rose)" }}>
                  {estProfit >= 0 ? "+" : ""}${estProfit.toFixed(2)}
                </p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: "var(--text-dim)" }}>{zh ? "若获胜" : "if correct"}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: 6, color: "var(--rose)" }}>
              <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem" }}>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleTrade}
            disabled={loading || stakeNum < MIN_STAKE || !selectedOutcomeId}
            style={{
              marginTop: "0.75rem", width: "100%",
              padding: "12px 20px",
              fontFamily: "var(--font-sans)", fontSize: "0.9375rem", fontWeight: 700,
              color: "var(--bg-base)",
              backgroundColor: "var(--gold)",
              border: "none", borderRadius: "var(--radius-sm)",
              cursor: loading || stakeNum < MIN_STAKE ? "not-allowed" : "pointer",
              opacity: loading || stakeNum < MIN_STAKE ? 0.5 : 1,
              transition: "opacity 150ms ease",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {loading
              ? (zh ? "处理中…" : "Placing trade…")
              : <>{zh ? "确认投注" : "Place trade"} <ChevronRight style={{ width: 16, height: 16 }} /></>
            }
          </button>
          <p style={{ marginTop: 6, textAlign: "center", fontFamily: "var(--font-sans)", fontSize: "0.6875rem", color: "var(--text-dim)" }}>
            {zh ? `可用余额: $${walletBalance.toFixed(2)}` : `Available: $${walletBalance.toFixed(2)}`}
          </p>
        </div>
      )}

      {!selectedOutcomeId && (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--text-dim)", textAlign: "center", paddingTop: "0.5rem" }}>
          {zh ? "👆 选择一个结果开始投注" : "👆 Select an outcome above to place your trade"}
        </p>
      )}
    </div>
  );
}
