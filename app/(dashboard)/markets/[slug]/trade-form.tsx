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
  locale: Locale;
  t: T["trade"];
};

// House economics:
//   • FEE_RATE      — added on top of the stake (visible to the user)
//   • OVERROUND     — multiplier on YES/NO prices so they sum to >1.0
//                      (built-in spread, what real sportsbooks do)
// Combined, these give the house ~6-7% edge per trade.
const FEE_RATE = 0.025;
const OVERROUND = 0.04;

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
  locale,
  t,
}: Props) {
  const [side, setSide] = useState<TradeSide>("yes");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successOrderType, setSuccessOrderType] = useState<"market" | "limit">("market");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // Order type: "market" (fill at current price now) or "limit" (fill when price hits target)
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");

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
  }, [isShortDuration, liveSpotPrice, spotPriceAtOpen, now, closeAt, yesPrice, candles]);

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

  // Validate the limit price input (only when in limit mode)
  const limitPriceNum = parseFloat(limitPrice);
  const isValidLimitPrice = orderType === "limit"
    ? Number.isFinite(limitPriceNum) && limitPriceNum > 0 && limitPriceNum < 1
    : true;

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
    if (orderType === "limit" && !isValidLimitPrice) {
      setError(locale === "zh" ? "请输入有效的限价 (0–1 之间)" : "Enter a valid limit price between 0 and 1.");
      return;
    }

    setLoading(true);
    try {
      let res: Response;
      if (orderType === "limit") {
        res = await fetch("/api/limit-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            market_id: marketId,
            side,
            amount: amountNum,
            target_price: limitPriceNum,
          }),
        });
      } else {
        res = await fetch("/api/trades", {
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
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Trade failed. Please try again.");
        return;
      }
      setSuccessOrderType(orderType);
      setSuccess(true);
      setAmount("");
      setLimitPrice("");
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
              {successOrderType === "limit" ? (t.limit_order_success ?? t.success) : t.success}
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
            {isShortDuration && rewardPreview && now != null ? (
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
                    <p className="mt-1 text-lg font-semibold text-green-600">
                      {payoutMultiplier != null ? `${payoutMultiplier}x` : "—"}
                    </p>
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
                    <span>{t.fee}</span>
                    <span className="font-medium">${fee}</span>
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
                {/* Order type toggle: Market vs Limit */}
                <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setOrderType("market")}
                    className={`flex-1 rounded py-1 text-xs font-semibold transition-colors ${
                      orderType === "market"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {locale === "zh" ? "市价单" : "Market"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("limit")}
                    className={`flex-1 rounded py-1 text-xs font-semibold transition-colors ${
                      orderType === "limit"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {locale === "zh" ? "限价单" : "Limit"}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSide("yes")}
                    disabled={isPredictionClosed}
                    className={`flex-1 rounded-md border py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      side === "yes"
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {upLabel} {liveYesPrice != null ? `@ $${parseFloat(liveYesPrice).toFixed(2)}` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide("no")}
                    disabled={isPredictionClosed}
                    className={`flex-1 rounded-md border py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      side === "no"
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {downLabel} {liveNoPrice != null ? `@ $${parseFloat(liveNoPrice).toFixed(2)}` : ""}
                  </button>
                </div>

                {/* Limit price input — only shown in limit mode */}
                {orderType === "limit" && (
                  <Input
                    type="number"
                    min="0.01"
                    max="0.99"
                    step="0.01"
                    placeholder={locale === "zh" ? "限价 (例如 0.40)" : "Target price (e.g. 0.40)"}
                    value={limitPrice}
                    onChange={(e) => {
                      setLimitPrice(e.target.value);
                      setError(null);
                    }}
                    disabled={isPredictionClosed}
                    form={`trade-form-${marketId}`}
                  />
                )}

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
                    disabled={submitDisabled || (orderType === "limit" && !isValidLimitPrice)}
                    className="shrink-0"
                    form={`trade-form-${marketId}`}
                  >
                    {loading
                      ? t.placing
                      : isPredictionClosed
                        ? uiText.predictionsClosed
                        : orderType === "limit"
                          ? `${locale === "zh" ? "下限价单" : "Place limit"} $${isValidAmount ? amountNum.toFixed(2) : "0"}`
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
