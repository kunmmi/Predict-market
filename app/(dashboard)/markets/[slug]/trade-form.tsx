"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { useBinanceKlineStream } from "@/lib/hooks/use-binance-kline-stream";
import { useWallet } from "@/lib/contexts/wallet-context";
import type { Locale, T } from "@/lib/i18n/translations";
import { sideLabel } from "@/lib/i18n/labels";
import {
  computeBinaryYesPrice,
  getPredictionDirectionFromTradeSide,
  getRewardPreview,
  getShortDurationCutoffAt,
  SHORT_DURATION_CUTOFF_SECONDS,
} from "@/lib/short-duration-predictions";
import { BUY_FEE_RATE, OVERROUND } from "@/lib/config/trading-constants";

type TradeSide = "yes" | "no";

type Props = {
  marketId: string;
  yesPrice: string | null;
  noPrice: string | null;
  marketStatus: string;
  isShortDuration?: boolean;
  assetSymbol: string;
  closeAt: string;
  cutoffAt?: string | null;
  spotPriceAtOpen?: string | null;
  durationMinutes?: number;
  isUpcoming?: boolean;
  locale: Locale;
  t: T["trade"];
  onTradeSuccess?: () => void;
  /** When true: renders content only (no Card wrapper). Used inside the mobile bottom sheet. */
  compact?: boolean;
};

// House economics imported from lib/config/trading-constants.ts
const FEE_RATE = BUY_FEE_RATE;

function formatCountdown(totalSeconds: number | null): string {
  if (totalSeconds == null) return "--:--";

  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TradeForm({
  marketId,
  yesPrice,
  noPrice,
  marketStatus,
  isShortDuration = false,
  assetSymbol,
  closeAt,
  cutoffAt,
  spotPriceAtOpen,
  durationMinutes,
  isUpcoming = false,
  locale,
  t,
  onTradeSuccess,
  compact = false,
}: Props) {
  const [side, setSide] = useState<TradeSide>("yes");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  // Shared wallet state across the dashboard — one fetch, many consumers
  const { wallet, loading: walletLoading, refetch: refetchWallet } = useWallet();

  const binanceSymbol = isShortDuration ? ASSET_TO_BINANCE[assetSymbol] ?? null : null;
  const { currentPrice: liveSpotPrice, candles } = useBinanceKlineStream(binanceSymbol);

  // Helper: apply the house overround margin to a fair probability.
  // Both YES and NO prices get scaled by (1 + OVERROUND), so they sum to
  // 1 + OVERROUND instead of 1.0 — a built-in spread on each trade.
  const applyOverround = (p: number): number => Math.max(0.01, Math.min(0.99, p * (1 + OVERROUND)));

  const liveYesPrice = useMemo(() => {
    // Upcoming rounds: opening price is unknown, so odds are always exactly 50/50
    if (isUpcoming) return String(applyOverround(0.5));

    if (!isShortDuration || liveSpotPrice == null || spotPriceAtOpen == null || now == null) {
      // For non-short-duration markets, apply overround directly to admin-set price
      if (yesPrice == null) return yesPrice;
      const fair = parseFloat(yesPrice);
      return String(applyOverround(fair));
    }
    const secondsRemaining = Math.max(0, Math.floor((new Date(closeAt).getTime() - now) / 1000));
    const fair = computeBinaryYesPrice({
      currentSpotPrice: liveSpotPrice,
      openingSpotPrice: Number(spotPriceAtOpen),
      secondsRemaining,
      recentCandles: candles,
    });
    return String(applyOverround(fair));
  }, [isUpcoming, isShortDuration, liveSpotPrice, spotPriceAtOpen, now, closeAt, yesPrice, candles]);

  const liveNoPrice = useMemo(() => {
    if (liveYesPrice == null) return noPrice;
    const yes = parseFloat(liveYesPrice);
    // Recover fair YES from displayed YES, then compute displayed NO with overround
    const fairYes = yes / (1 + OVERROUND);
    return String(applyOverround(1 - fairYes));
  }, [liveYesPrice, noPrice]);

  // Refresh shared wallet when a trade succeeds so the new balance shows
  useEffect(() => {
    if (success) {
      void refetchWallet();
    }
  }, [success, refetchWallet]);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => window.clearInterval(interval);
  }, []);

  const currentPrice = side === "yes" ? liveYesPrice : liveNoPrice;
  const priceNum = currentPrice != null ? parseFloat(currentPrice) : null;
  const amountNum = parseFloat(amount);
  const isValidAmount = !Number.isNaN(amountNum) && amountNum > 0 && amountNum <= 100;

  const estimatedUnits =
    isValidAmount && priceNum != null && priceNum > 0 ? (amountNum / priceNum).toFixed(4) : null;
  const fee = isValidAmount ? (amountNum * FEE_RATE).toFixed(4) : null;
  const totalDebit = isValidAmount ? (amountNum + amountNum * FEE_RATE).toFixed(4) : null;
  const potentialPayout =
    isValidAmount && priceNum != null && priceNum > 0 ? (amountNum / priceNum).toFixed(2) : null;
  const payoutMultiplier = priceNum != null && priceNum > 0 ? (1 / priceNum).toFixed(2) : null;

  const availableBalance = wallet != null ? parseFloat(wallet.availableBalance) : null;
  const insufficientFunds =
    isValidAmount && availableBalance != null && amountNum > availableBalance;

  const upLabel = isShortDuration ? (t.up_label ?? "UP") : sideLabel("yes", locale);
  const downLabel = isShortDuration ? (t.down_label ?? "DOWN") : sideLabel("no", locale);
  const activeLabel = side === "yes" ? upLabel : downLabel;
  const uiText = {
    currentRoundTimer: t.current_round_timer ?? "Round timer",
    cutoffCountdown: t.cutoff_countdown ?? "Prediction cutoff",
    potentialPayout: t.potential_payout ?? "If you win",
    openingPrice: t.opening_price ?? "Opening price",
    entryPrice: t.entry_price ?? "Entry price",
    liveConfidence: t.live_confidence ?? "Live confidence",
    predictionsClosed: t.predictions_closed ?? "Predictions closed",
    predictionsClosedMessage:
      t.predictions_closed_message ?? "Predictions closed for this round. Next round starts soon.",
    cutoffNote:
      t.cutoff_note ?? "Predictions close {seconds} seconds before the round ends.",
    upcomingNotStarted: t.upcoming_not_started ?? "Round not started yet — bet now at 50/50 odds",
    upcomingOpensIn: t.upcoming_opens_in ?? "Opens in",
    upcomingPriceToBeat: t.upcoming_price_to_beat ?? "Price to Beat",
  };

  const rewardPreview = useMemo(() => {
    if (!isShortDuration) return null;

    return getRewardPreview({
      closesAt: closeAt,
      cutoffAt: cutoffAt ?? getShortDurationCutoffAt(closeAt).toISOString(),
      now: now ?? undefined,
      direction: getPredictionDirectionFromTradeSide(side),
      confidencePrice: priceNum,
      currentSpotPrice: liveSpotPrice,
      openingSpotPrice: spotPriceAtOpen != null ? Number(spotPriceAtOpen) : null,
    });
  }, [closeAt, cutoffAt, isShortDuration, liveSpotPrice, now, priceNum, side, spotPriceAtOpen]);

  const isPredictionClosed = rewardPreview?.isClosed ?? false;
  const submitDisabled =
    loading || insufficientFunds || priceNum == null || !isValidAmount || isPredictionClosed;

  if (marketStatus !== "active") {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!isValidAmount) {
      setError("Please enter a valid amount.");
      return;
    }
    if (priceNum == null) {
      setError("Market price is not available. Please wait for an admin to set prices.");
      return;
    }
    if (insufficientFunds) {
      setError("Insufficient available balance.");
      return;
    }
    if (isPredictionClosed) {
      setError(uiText.predictionsClosedMessage);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market_id: marketId,
          side,
          amount: String(amountNum),
          price: String(priceNum),
          fee_amount: fee ?? "0",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Trade failed. Please try again.");
        return;
      }
      setSuccess(true);
      setAmount("");
      onTradeSuccess?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inner = (
        <>
        {success ? (
          <div className="space-y-4">
            <div style={{ borderRadius: "var(--radius-sm)", border: "1px solid rgba(13,184,145,0.25)", backgroundColor: "var(--teal-dim)", padding: "12px 16px", fontSize: "0.875rem", fontWeight: 500, color: "var(--teal)" }}>
              {t.success}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSuccess(false);
                setAmount("");
              }}
            >
              {t.place_another}
            </Button>
          </div>
        ) : (
          <form id={`trade-form-${marketId}${compact ? "-m" : ""}`} onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Upcoming round info banner */}
            {!compact && isUpcoming && isShortDuration && durationMinutes != null && now != null && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border-gold)", backgroundColor: "var(--gold-dim)", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", fontWeight: 600, color: "var(--gold)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "var(--gold)", animation: "pulseDot 1s ease-in-out infinite", flexShrink: 0 }} />
                  {uiText.upcomingNotStarted}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: uiText.upcomingOpensIn, value: formatCountdown(Math.max(0, Math.floor((new Date(closeAt).getTime() - durationMinutes * 60_000 - now) / 1_000))), color: "var(--gold)" },
                    { label: uiText.upcomingPriceToBeat, value: "—", color: "var(--text-dim)" },
                    { label: uiText.potentialPayout, value: payoutMultiplier != null ? `${payoutMultiplier}×` : "—", color: "var(--teal)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-elevated)", padding: "8px 12px" }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)" }}>{label}</p>
                      <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 600, color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!compact && isShortDuration && !isUpcoming && rewardPreview && now != null ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-elevated)", padding: 14 }}>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: uiText.currentRoundTimer, value: formatCountdown(rewardPreview.secondsRemaining), color: "var(--text-primary)" },
                    { label: uiText.cutoffCountdown, value: isPredictionClosed ? uiText.predictionsClosed : formatCountdown(rewardPreview.cutoffSecondsRemaining), color: isPredictionClosed ? "var(--rose)" : "var(--text-primary)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)", padding: "8px 12px" }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)" }}>{label}</p>
                      <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 600, color }}>{value}</p>
                    </div>
                  ))}
                  <div style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)", padding: "8px 12px" }}>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)" }}>{uiText.potentialPayout}</p>
                    {isValidAmount && liveYesPrice != null && liveNoPrice != null ? (
                      <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "var(--teal)" }}>↑ ${(amountNum / parseFloat(liveYesPrice)).toFixed(2)}</span>
                        <span style={{ color: "var(--border-strong)", fontSize: "0.75rem" }}>|</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "var(--rose)" }}>↓ ${(amountNum / parseFloat(liveNoPrice)).toFixed(2)}</span>
                      </div>
                    ) : (
                      <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 600, color: "var(--teal)" }}>
                        {payoutMultiplier != null ? `${payoutMultiplier}×` : "—"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: uiText.entryPrice,    value: liveSpotPrice != null ? `$${liveSpotPrice.toFixed(2)}` : "—" },
                    { label: uiText.openingPrice,  value: spotPriceAtOpen != null ? `$${Number(spotPriceAtOpen).toFixed(2)}` : "—" },
                    { label: uiText.liveConfidence, value: priceNum != null ? `${(priceNum * 100).toFixed(1)}%` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)", padding: "8px 12px" }}>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)" }}>{label}</p>
                      <p style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{value}</p>
                    </div>
                  ))}
                </div>

                {isPredictionClosed ? (
                  <div style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border-gold)", backgroundColor: "var(--gold-dim)", padding: "8px 12px", fontSize: "0.875rem", fontWeight: 500, color: "var(--gold)" }}>
                    {uiText.predictionsClosedMessage}
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div style={{ borderRadius: "var(--radius-sm)", border: "1px solid rgba(232,68,90,0.3)", backgroundColor: "var(--rose-dim)", padding: "12px 16px", fontSize: "0.875rem", color: "var(--rose)" }}>
                {error}
              </div>
            ) : null}

            {!compact && isValidAmount && priceNum != null ? (
              <div style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-elevated)", padding: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{t.est_units}</span>
                    <span style={{ fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{estimatedUnits}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>{locale === "zh" ? "手续费 (2%)" : "Handling fee (2%)"}</span>
                    <span style={{ fontWeight: 500, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>${fee}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{uiText.potentialPayout}</span>
                    <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--teal)" }}>
                      {potentialPayout != null ? `$${potentialPayout}` : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-dim)", paddingTop: 6 }}>
                    <span style={{ fontWeight: 500 }}>{t.total_debit}</span>
                    <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>${totalDebit}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {!compact && priceNum == null ? <p style={{ fontSize: "0.875rem", color: "var(--gold)" }}>{t.no_price}</p> : null}

            {!compact && isShortDuration ? (
              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                {uiText.cutoffNote.replace("{seconds}", String(SHORT_DURATION_CUTOFF_SECONDS))}
              </p>
            ) : null}

            {/* ── Action bar — inline on all screen sizes ──────────────────── */}
            <div className="space-y-3">
              {/* Direction buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                {(
                  [
                    { s: "yes" as TradeSide, label: upLabel,   livePrice: liveYesPrice, accent: "var(--teal)", dimBg: "rgba(13,184,145,0.12)", dimBorder: "rgba(13,184,145,0.25)", selBg: "rgba(13,184,145,0.22)", selBorder: "rgba(13,184,145,0.5)" },
                    { s: "no"  as TradeSide, label: downLabel, livePrice: liveNoPrice,  accent: "var(--rose)", dimBg: "rgba(232,68,90,0.12)",  dimBorder: "rgba(232,68,90,0.25)",  selBg: "rgba(232,68,90,0.22)",  selBorder: "rgba(232,68,90,0.5)"  },
                  ] as const
                ).map(({ s, label, livePrice, accent, dimBg, dimBorder, selBg, selBorder }) => {
                  const p    = livePrice != null ? parseFloat(livePrice) : null;
                  const mult = p != null && p > 0 ? (1 / p).toFixed(2) : null;
                  const isSelected = side === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSide(s)}
                      disabled={isPredictionClosed}
                      style={{
                        flex: 1,
                        borderRadius: "var(--radius-md)",
                        border: `2px solid ${isSelected ? selBorder : dimBorder}`,
                        backgroundColor: isSelected ? selBg : dimBg,
                        padding: "12px",
                        textAlign: "center",
                        cursor: isPredictionClosed ? "not-allowed" : "pointer",
                        opacity: isPredictionClosed ? 0.6 : 1,
                        transition: "background-color 200ms ease, opacity 200ms ease, box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)",
                        boxShadow: isSelected ? `0 0 16px ${dimBg}` : "none",
                      }}
                    >
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: accent, opacity: 0.9 }}>
                        {label}
                      </div>
                      <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em", color: accent }}>
                        {p != null ? `${(p * 100).toFixed(0)}¢` : "—"}
                      </div>
                      <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 600, color: accent, opacity: isSelected ? 0.9 : 0.6 }}>
                        {mult != null ? `${mult}× payout` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  placeholder={t.amount_label}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  required
                  disabled={isPredictionClosed}
                  className="flex-1"
                  form={`trade-form-${marketId}${compact ? "-m" : ""}`}
                />
                <Button
                  type="submit"
                  disabled={submitDisabled}
                  className="shrink-0"
                  form={`trade-form-${marketId}${compact ? "-m" : ""}`}
                >
                  {loading
                    ? t.placing
                    : isPredictionClosed
                      ? uiText.predictionsClosed
                      : `${activeLabel} $${isValidAmount ? amountNum.toFixed(2) : "0"}`}
                </Button>
              </div>

              {walletLoading ? (
                <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{t.loading_balance}</p>
              ) : availableBalance != null ? (
                <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  {t.available} ${availableBalance.toFixed(2)}
                  {insufficientFunds && (
                    <span style={{ marginLeft: 4, fontWeight: 500, color: "var(--rose)" }}>{t.insufficient}</span>
                  )}
                  {!Number.isNaN(amountNum) && amountNum > 100 && (
                    <span style={{ marginLeft: 8, fontWeight: 500, color: "var(--rose)" }}>Max $100.</span>
                  )}
                </p>
              ) : null}
            </div>
          </form>
        )}
        </>
  );

  if (compact) return inner;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}
