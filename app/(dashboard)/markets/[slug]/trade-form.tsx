"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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
}: Props) {
  const [side, setSide] = useState<TradeSide>("yes");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // Shared wallet state across the dashboard — one fetch, many consumers
  const { wallet, loading: walletLoading, refetch: refetchWallet } = useWallet();

  useEffect(() => setMounted(true), []);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="space-y-4">
            <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
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
          <form id={`trade-form-${marketId}`} onSubmit={handleSubmit} className="space-y-4">
            {/* Upcoming round info banner */}
            {isUpcoming && isShortDuration && durationMinutes != null && now != null && (
              <div className="space-y-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-yellow-800">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                  Round not started yet — bet now at 50/50 odds
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-yellow-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Opens in</p>
                    <p className="mt-1 text-lg font-semibold text-yellow-700">
                      {formatCountdown(Math.max(0, Math.floor((new Date(closeAt).getTime() - durationMinutes * 60_000 - now) / 1_000)))}
                    </p>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Price to Beat</p>
                    <p className="mt-1 text-lg font-semibold text-slate-400">—</p>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{uiText.potentialPayout}</p>
                    <p className="mt-1 text-lg font-semibold text-green-600">
                      {payoutMultiplier != null ? `${payoutMultiplier}×` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isShortDuration && !isUpcoming && rewardPreview && now != null ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{uiText.currentRoundTimer}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {formatCountdown(rewardPreview.secondsRemaining)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{uiText.cutoffCountdown}</p>
                    <p className={`mt-1 text-lg font-semibold ${isPredictionClosed ? "text-red-600" : "text-slate-900"}`}>
                      {isPredictionClosed
                        ? uiText.predictionsClosed
                        : formatCountdown(rewardPreview.cutoffSecondsRemaining)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{uiText.potentialPayout}</p>
                    {isValidAmount && liveYesPrice != null && liveNoPrice != null ? (
                      <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-green-600">
                          ↑ ${(amountNum / parseFloat(liveYesPrice)).toFixed(2)}
                        </span>
                        <span className="text-slate-300 text-xs">|</span>
                        <span className="text-sm font-bold text-red-500">
                          ↓ ${(amountNum / parseFloat(liveNoPrice)).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1 text-lg font-semibold text-green-600">
                        {payoutMultiplier != null ? `${payoutMultiplier}×` : "—"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{uiText.entryPrice}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {liveSpotPrice != null ? `$${liveSpotPrice.toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{uiText.openingPrice}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {spotPriceAtOpen != null ? `$${Number(spotPriceAtOpen).toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{uiText.liveConfidence}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {priceNum != null ? `${(priceNum * 100).toFixed(1)}%` : "—"}
                    </p>
                  </div>
                </div>

                {isPredictionClosed ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                    {uiText.predictionsClosedMessage}
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {isValidAmount && priceNum != null ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="space-y-1 text-slate-700">
                  <div className="flex justify-between">
                    <span>{t.est_units}</span>
                    <span className="font-medium">{estimatedUnits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {locale === "zh" ? "手续费 (2%)" : "Handling fee (2%)"}
                    </span>
                    <span className="font-medium text-slate-500">${fee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{uiText.potentialPayout}</span>
                    <span className="font-medium text-green-600">
                      {potentialPayout != null ? `$${potentialPayout}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1">
                    <span className="font-medium">{t.total_debit}</span>
                    <span className="font-semibold">${totalDebit}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {priceNum == null ? <p className="text-sm text-amber-600">{t.no_price}</p> : null}

            {isShortDuration ? (
              <p className="text-xs text-slate-500">
                {uiText.cutoffNote.replace("{seconds}", String(SHORT_DURATION_CUTOFF_SECONDS))}
              </p>
            ) : null}

            {/* Spacer so content above isn't hidden by the sticky action bar + bottom nav on mobile */}
            <div className="h-64 lg:hidden" aria-hidden />

            {/* ── Sticky bottom action bar — rendered via Portal on mobile so it ───
                  escapes any ancestor `transform` (animations) that would break
                  position:fixed. On desktop it renders inline inside the card. */}
            {(() => {
              const actionBar = (
                <div className="mx-auto max-w-3xl space-y-3">
                {/* Direction buttons — show price + multiplier for both sides so the
                    contrast between the obvious and long-shot side is instantly visible */}
                <div className="flex gap-2">
                  {(
                    [
                      { s: "yes" as TradeSide, label: upLabel,   livePrice: liveYesPrice, sel: "green" },
                      { s: "no"  as TradeSide, label: downLabel, livePrice: liveNoPrice,  sel: "red"   },
                    ] as const
                  ).map(({ s, label, livePrice, sel }) => {
                    const p    = livePrice != null ? parseFloat(livePrice) : null;
                    const mult = p != null && p > 0 ? (1 / p).toFixed(2) : null;
                    const isSelected = side === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSide(s)}
                        disabled={isPredictionClosed}
                        className={`flex-1 rounded-xl border-2 px-3 py-3 text-center transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                          isSelected
                            ? sel === "green"
                              ? "border-green-500 bg-green-500 text-white shadow-md"
                              : "border-red-500 bg-red-500 text-white shadow-md"
                            : sel === "green"
                              ? "border-green-200 bg-green-50 text-green-800 hover:border-green-400 hover:bg-green-100"
                              : "border-red-200 bg-red-50 text-red-800 hover:border-red-400 hover:bg-red-100"
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                          {label}
                        </div>
                        <div className="mt-0.5 text-2xl font-bold tabular-nums">
                          {p != null ? `${(p * 100).toFixed(0)}¢` : "—"}
                        </div>
                        <div className={`mt-0.5 text-xs font-semibold tabular-nums ${isSelected ? "opacity-90" : "opacity-60"}`}>
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
                    form={`trade-form-${marketId}`}
                  />
                  <Button
                    type="submit"
                    disabled={submitDisabled}
                    className="shrink-0"
                    form={`trade-form-${marketId}`}
                  >
                    {loading
                      ? t.placing
                      : isPredictionClosed
                        ? uiText.predictionsClosed
                        : `${activeLabel} $${isValidAmount ? amountNum.toFixed(2) : "0"}`}
                  </Button>
                </div>

                {walletLoading ? (
                  <p className="text-xs text-slate-400">{t.loading_balance}</p>
                ) : availableBalance != null ? (
                  <p className="text-xs text-slate-500">
                    {t.available} ${availableBalance.toFixed(2)}
                    {insufficientFunds ? (
                      <span className="ml-1 font-medium text-red-600">{t.insufficient}</span>
                    ) : null}
                    {!Number.isNaN(amountNum) && amountNum > 100 && (
                      <span className="ml-2 font-medium text-red-600">Max $100.</span>
                    )}
                  </p>
                ) : null}
                </div>
              );

              return (
                <>
                  {/* Mobile: render via portal so position:fixed works correctly */}
                  {mounted &&
                    createPortal(
                      <div className="fixed bottom-[calc(theme(spacing.16)+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-slate-200 bg-white px-4 pt-3 pb-3 shadow-[0_-6px_18px_rgba(15,23,42,0.08)] lg:hidden">
                        {actionBar}
                      </div>,
                      document.body,
                    )}

                  {/* Desktop: inline inside the card */}
                  <div className="hidden lg:block">{actionBar}</div>
                </>
              );
            })()}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
