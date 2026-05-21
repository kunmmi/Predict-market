"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useVisibilityPoll } from "@/lib/hooks/use-visibility-poll";
import { useBinanceKlineStream } from "@/lib/hooks/use-binance-kline-stream";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { computeBinaryYesPrice } from "@/lib/short-duration-predictions";
import { useWallet } from "@/lib/contexts/wallet-context";
import { OVERROUND, SELL_FEE_RATE } from "@/lib/config/trading-constants";
import type { Locale } from "@/lib/i18n/translations";

type Position = {
  hasPosition: false;
} | {
  hasPosition: true;
  positionId: string;
  yesUnits: number;
  noUnits: number;
  avgYesPrice: number | null;
  avgNoPrice: number | null;
};

type Props = {
  marketId: string;
  isShortDuration: boolean;
  assetSymbol: string;
  closeAt: string;
  spotPriceAtOpen: string | null | undefined;
  locale: Locale;
  /** Bumped by TradeArea when a new trade is placed. */
  refreshTick?: number;
};

export function MarketPositionPanel({
  marketId,
  isShortDuration,
  assetSymbol,
  closeAt,
  spotPriceAtOpen,
  locale,
  refreshTick,
}: Props) {
  const zh = locale === "zh";

  const [position, setPosition] = useState<Position | null>(null);
  const [now, setNow] = useState(Date.now());

  // Sell form state
  const [sellSide, setSellSide] = useState<"yes" | "no" | null>(null);
  const [sellUnits, setSellUnits] = useState("");
  const [selling, setSelling] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellSuccess, setSellSuccess] = useState(false);

  const { refetch: refetchWallet } = useWallet();

  // Live spot price from Binance (only for short-duration markets)
  const binanceSymbol = isShortDuration ? (ASSET_TO_BINANCE[assetSymbol] ?? null) : null;
  const { currentPrice: liveSpotPrice, candles } = useBinanceKlineStream(binanceSymbol);

  // Tick every second so time-based prices stay fresh
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  // Live YES price (same formula as trade-form)
  const liveYesPrice = useMemo(() => {
    if (!isShortDuration || liveSpotPrice == null || spotPriceAtOpen == null) return null;
    const secondsRemaining = Math.max(0, Math.floor((new Date(closeAt).getTime() - now) / 1_000));
    const fair = computeBinaryYesPrice({
      currentSpotPrice: liveSpotPrice,
      openingSpotPrice: Number(spotPriceAtOpen),
      secondsRemaining,
      recentCandles: candles,
    });
    return Math.max(0.01, Math.min(0.99, fair * (1 + OVERROUND)));
  }, [isShortDuration, liveSpotPrice, spotPriceAtOpen, closeAt, now, candles]);

  const liveNoPrice = useMemo(() => {
    if (liveYesPrice == null) return null;
    const fairYes = liveYesPrice / (1 + OVERROUND);
    return Math.max(0.01, Math.min(0.99, (1 - fairYes) * (1 + OVERROUND)));
  }, [liveYesPrice]);

  const fetchPosition = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/my-position`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setPosition(json as Position);
    } catch {
      // non-critical
    }
  }, [marketId]);

  useEffect(() => { void fetchPosition(); }, [fetchPosition]);

  useEffect(() => {
    if (!refreshTick) return;
    setSellSuccess(false);
    void fetchPosition();
  }, [refreshTick, fetchPosition]);

  useVisibilityPoll(fetchPosition, 5_000);

  if (!position || !position.hasPosition) return null;

  const { positionId, yesUnits, noUnits, avgYesPrice, avgNoPrice } = position;
  const hasYes = yesUnits > 0.0001;
  const hasNo  = noUnits  > 0.0001;

  // Current market value of holdings
  const yesPriceForCalc = liveYesPrice ?? null;
  const noPriceForCalc  = liveNoPrice  ?? null;

  const yesCurrentValue = hasYes && yesPriceForCalc != null ? yesUnits * yesPriceForCalc : null;
  const noCurrentValue  = hasNo  && noPriceForCalc  != null ? noUnits  * noPriceForCalc  : null;

  // Cost basis
  const yesCost = hasYes && avgYesPrice != null ? yesUnits * avgYesPrice : null;
  const noCost  = hasNo  && avgNoPrice  != null ? noUnits  * avgNoPrice  : null;

  const yesPnl = yesCurrentValue != null && yesCost != null ? yesCurrentValue - yesCost : null;
  const noPnl  = noCurrentValue  != null && noCost  != null ? noCurrentValue  - noCost  : null;

  // Payout if wins ($1 per unit)
  const upLabel   = isShortDuration ? (zh ? "UP"   : "UP")   : "YES";
  const downLabel = isShortDuration ? (zh ? "DOWN" : "DOWN") : "NO";

  // Sell form helpers
  const openSell = (side: "yes" | "no") => {
    setSellSide(side);
    setSellUnits(side === "yes" ? String(yesUnits) : String(noUnits));
    setSellError(null);
    setSellSuccess(false);
  };
  const closeSell = () => { setSellSide(null); setSellUnits(""); setSellError(null); };

  const sellUnitsNum = parseFloat(sellUnits);
  const maxSellUnits = sellSide === "yes" ? yesUnits : noUnits;
  const sellPrice    = sellSide === "yes" ? yesPriceForCalc : noPriceForCalc;
  const estimatedGross = !isNaN(sellUnitsNum) && sellUnitsNum > 0 && sellPrice != null
    ? sellUnitsNum * sellPrice
    : null;
  const estimatedPayout = estimatedGross != null
    ? estimatedGross * (1 - SELL_FEE_RATE)
    : null;

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellSide) return;
    setSelling(true);
    setSellError(null);
    try {
      const res = await fetch("/api/trades/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position_id: positionId, side: sellSide, units: sellUnits }),
      });
      const json = await res.json() as { message?: string; payout?: number };
      if (!res.ok) { setSellError(json.message ?? "Sell failed."); return; }
      setSellSuccess(true);
      closeSell();
      void refetchWallet();
      void fetchPosition();
    } catch {
      setSellError(zh ? "网络错误，请重试。" : "Network error. Please try again.");
    } finally {
      setSelling(false);
    }
  };

  const fmt = (n: number) => n.toFixed(2);
  const fmtPnl = (n: number) => `${n >= 0 ? "+" : ""}$${fmt(Math.abs(n))}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {zh ? "我的持仓" : "Your Position"}
      </p>

      {sellSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          {zh ? "出售成功，收益已到账。" : "Sold successfully — proceeds credited to your wallet."}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {hasYes && (
          <div className="rounded-lg border border-green-200 bg-white px-4 py-3 space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-green-600">{upLabel}</span>
              {sellSide !== "yes" && (
                <button
                  onClick={() => openSell("yes")}
                  className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors"
                >
                  {zh ? "卖出" : "Sell"}
                </button>
              )}
            </div>

            {/* Units + value */}
            <div>
              <p className="text-xl font-bold tabular-nums text-slate-900">
                {yesUnits.toFixed(4)} {zh ? "份" : "units"}
              </p>
              <div className="mt-0.5 flex items-baseline gap-2 text-xs text-slate-500">
                {avgYesPrice != null && (
                  <span>{zh ? "均价" : "Avg"} ${avgYesPrice.toFixed(3)}</span>
                )}
                {yesCurrentValue != null && (
                  <span className="ml-auto">{zh ? "当前" : "Value"} <span className="font-semibold text-slate-800">${fmt(yesCurrentValue)}</span></span>
                )}
              </div>
              {yesPnl != null && (
                <p className={`mt-0.5 text-xs font-semibold ${yesPnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {fmtPnl(yesPnl)} {zh ? "浮动盈亏" : "unrealized"}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {zh ? "满仓赢得" : "To win"} <span className="font-semibold text-green-600">${fmt(yesUnits)}</span>
              </p>
            </div>

            {/* Inline sell form */}
            {sellSide === "yes" && (
              <form onSubmit={handleSell} className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{zh ? "卖出 UP" : "Sell UP"}</span>
                  <button type="button" onClick={closeSell} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.0001"
                    max={maxSellUnits}
                    step="0.0001"
                    value={sellUnits}
                    onChange={(e) => setSellUnits(e.target.value)}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder={zh ? "数量" : "Units"}
                  />
                  <button
                    type="button"
                    onClick={() => setSellUnits(String(yesUnits))}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    {zh ? "全部" : "Max"}
                  </button>
                </div>
                {estimatedPayout != null && (
                  <p className="text-xs text-slate-500">
                    {zh ? "预计到账" : "Proceeds"}{" "}
                    <span className="font-semibold text-slate-800">${fmt(estimatedPayout)}</span>
                  </p>
                )}
                {sellError && <p className="text-xs text-red-600">{sellError}</p>}
                <button
                  type="submit"
                  disabled={selling || isNaN(sellUnitsNum) || sellUnitsNum <= 0 || sellUnitsNum > maxSellUnits}
                  className="w-full rounded-md bg-green-600 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {selling ? (zh ? "处理中…" : "Processing…") : zh ? `确认卖出 $${estimatedPayout != null ? fmt(estimatedPayout) : "—"}` : `Confirm sell · $${estimatedPayout != null ? fmt(estimatedPayout) : "—"}`}
                </button>
              </form>
            )}
          </div>
        )}

        {hasNo && (
          <div className="rounded-lg border border-red-200 bg-white px-4 py-3 space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-red-500">{downLabel}</span>
              {sellSide !== "no" && (
                <button
                  onClick={() => openSell("no")}
                  className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                >
                  {zh ? "卖出" : "Sell"}
                </button>
              )}
            </div>

            {/* Units + value */}
            <div>
              <p className="text-xl font-bold tabular-nums text-slate-900">
                {noUnits.toFixed(4)} {zh ? "份" : "units"}
              </p>
              <div className="mt-0.5 flex items-baseline gap-2 text-xs text-slate-500">
                {avgNoPrice != null && (
                  <span>{zh ? "均价" : "Avg"} ${avgNoPrice.toFixed(3)}</span>
                )}
                {noCurrentValue != null && (
                  <span className="ml-auto">{zh ? "当前" : "Value"} <span className="font-semibold text-slate-800">${fmt(noCurrentValue)}</span></span>
                )}
              </div>
              {noPnl != null && (
                <p className={`mt-0.5 text-xs font-semibold ${noPnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {fmtPnl(noPnl)} {zh ? "浮动盈亏" : "unrealized"}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {zh ? "满仓赢得" : "To win"} <span className="font-semibold text-red-500">${fmt(noUnits)}</span>
              </p>
            </div>

            {/* Inline sell form */}
            {sellSide === "no" && (
              <form onSubmit={handleSell} className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{zh ? "卖出 DOWN" : "Sell DOWN"}</span>
                  <button type="button" onClick={closeSell} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.0001"
                    max={maxSellUnits}
                    step="0.0001"
                    value={sellUnits}
                    onChange={(e) => setSellUnits(e.target.value)}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder={zh ? "数量" : "Units"}
                  />
                  <button
                    type="button"
                    onClick={() => setSellUnits(String(noUnits))}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    {zh ? "全部" : "Max"}
                  </button>
                </div>
                {estimatedPayout != null && (
                  <p className="text-xs text-slate-500">
                    {zh ? "预计到账" : "Proceeds"}{" "}
                    <span className="font-semibold text-slate-800">${fmt(estimatedPayout)}</span>
                  </p>
                )}
                {sellError && <p className="text-xs text-red-600">{sellError}</p>}
                <button
                  type="submit"
                  disabled={selling || isNaN(sellUnitsNum) || sellUnitsNum <= 0 || sellUnitsNum > maxSellUnits}
                  className="w-full rounded-md bg-red-600 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {selling ? (zh ? "处理中…" : "Processing…") : zh ? `确认卖出 $${estimatedPayout != null ? fmt(estimatedPayout) : "—"}` : `Confirm sell · $${estimatedPayout != null ? fmt(estimatedPayout) : "—"}`}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
