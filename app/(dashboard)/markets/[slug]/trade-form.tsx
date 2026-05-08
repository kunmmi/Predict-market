"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { useBinancePrice } from "@/lib/hooks/use-binance-price";
import type { Locale, T } from "@/lib/i18n/translations";
import { sideLabel } from "@/lib/i18n/labels";
import {
  getPredictionDirectionFromTradeSide,
  getRewardPreview,
  getShortDurationCutoffAt,
  SHORT_DURATION_CUTOFF_SECONDS,
} from "@/lib/short-duration-predictions";

type TradeSide = "yes" | "no";

type WalletData = {
  availableBalance: string;
  status: string;
};

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

const FEE_RATE = 0.02;

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
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const binanceSymbol = isShortDuration ? ASSET_TO_BINANCE[assetSymbol] ?? null : null;
  const { price: liveSpotPrice } = useBinancePrice(binanceSymbol);

  useEffect(() => {
    async function fetchWallet() {
      try {
        const res = await fetch("/api/wallet");
        if (res.ok) {
          const json = await res.json();
          setWallet(json.wallet);
        }
      } finally {
        setWalletLoading(false);
      }
    }

    void fetchWallet();
  }, [success]);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => window.clearInterval(interval);
  }, []);

  const currentPrice = side === "yes" ? yesPrice : noPrice;
  const priceNum = currentPrice != null ? parseFloat(currentPrice) : null;
  const amountNum = parseFloat(amount);
  const isValidAmount = !Number.isNaN(amountNum) && amountNum > 0;

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

  const upLabel = isShortDuration ? (locale === "zh" ? "çœ‹æ¶¨" : "UP") : sideLabel("yes", locale);
  const downLabel = isShortDuration ? (locale === "zh" ? "çœ‹è·Œ" : "DOWN") : sideLabel("no", locale);
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
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">{t.side}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSide("yes")}
                  disabled={isPredictionClosed}
                  className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    side === "yes"
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {upLabel} {yesPrice != null ? `@ $${parseFloat(yesPrice).toFixed(2)}` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setSide("no")}
                  disabled={isPredictionClosed}
                  className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    side === "no"
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {downLabel} {noPrice != null ? `@ $${parseFloat(noPrice).toFixed(2)}` : ""}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">{t.amount_label}</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="10.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                required
                disabled={isPredictionClosed}
              />
              {walletLoading ? (
                <p className="text-xs text-slate-400">{t.loading_balance}</p>
              ) : availableBalance != null ? (
                <p className="text-xs text-slate-500">
                  {t.available} ${availableBalance.toFixed(2)}
                  {insufficientFunds ? (
                    <span className="ml-1 font-medium text-red-600">{t.insufficient}</span>
                  ) : null}
                </p>
              ) : null}
            </div>

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

            <Button
              type="submit"
              disabled={submitDisabled}
              className="w-full"
            >
              {loading
                ? t.placing
                : isPredictionClosed
                  ? uiText.predictionsClosed
                  : `${activeLabel} - $${isValidAmount ? amountNum.toFixed(2) : "0.00"}`}
            </Button>

            {isShortDuration ? (
              <p className="text-xs text-slate-500">
                {uiText.cutoffNote.replace("{seconds}", String(SHORT_DURATION_CUTOFF_SECONDS))}
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
