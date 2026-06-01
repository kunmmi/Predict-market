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
  /** Called when the user taps "Buy Again" */
  onBuyAgain?: () => void;
};

export function MarketPositionPanel({
  marketId,
  isShortDuration,
  assetSymbol,
  closeAt,
  spotPriceAtOpen,
  locale,
  refreshTick,
  onBuyAgain,
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

  const binanceSymbol = isShortDuration ? (ASSET_TO_BINANCE[assetSymbol] ?? null) : null;
  const { currentPrice: liveSpotPrice, candles } = useBinanceKlineStream(binanceSymbol);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

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

  const yesPriceForCalc = liveYesPrice ?? null;
  const noPriceForCalc  = liveNoPrice  ?? null;

  const yesCurrentValue = hasYes && yesPriceForCalc != null ? yesUnits * yesPriceForCalc : null;
  const noCurrentValue  = hasNo  && noPriceForCalc  != null ? noUnits  * noPriceForCalc  : null;

  const yesCost = hasYes && avgYesPrice != null ? yesUnits * avgYesPrice : null;
  const noCost  = hasNo  && avgNoPrice  != null ? noUnits  * avgNoPrice  : null;

  const yesPnl = yesCurrentValue != null && yesCost != null ? yesCurrentValue - yesCost : null;
  const noPnl  = noCurrentValue  != null && noCost  != null ? noCurrentValue  - noCost  : null;

  const upLabel   = isShortDuration ? (zh ? "看涨" : "UP")   : "YES";
  const downLabel = isShortDuration ? (zh ? "看跌" : "DOWN") : "NO";

  const openSell = (side: "yes" | "no") => {
    setSellSide(side);
    setSellUnits(side === "yes" ? String(yesUnits) : String(noUnits));
    setSellError(null);
    setSellSuccess(false);
  };
  const closeSell = () => { setSellSide(null); setSellUnits(""); setSellError(null); };

  const sellUnitsNum  = parseFloat(sellUnits);
  const maxSellUnits  = sellSide === "yes" ? yesUnits : noUnits;
  const sellPrice     = sellSide === "yes" ? yesPriceForCalc : noPriceForCalc;
  const estimatedGross = !isNaN(sellUnitsNum) && sellUnitsNum > 0 && sellPrice != null
    ? sellUnitsNum * sellPrice : null;
  const estimatedPayout = estimatedGross != null ? estimatedGross * (1 - SELL_FEE_RATE) : null;

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

  const fmt    = (n: number) => n.toFixed(2);
  const fmtPnl = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;

  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-surface)",
        padding: "16px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-dim)" }}>
          {zh ? "我的持仓" : "Your Position"}
        </p>
        {/* Buy Again */}
        {onBuyAgain && (
          <button
            type="button"
            onClick={onBuyAgain}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 14px",
              borderRadius: 100,
              background: "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)",
              color: "#070809",
              fontFamily: "var(--font-sans)",
              fontSize: "0.75rem",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(232,160,32,0.25)",
              transition: "opacity 150ms ease",
            }}
            className="active:scale-[0.97] hover:opacity-90"
          >
            {zh ? "继续买入" : "Buy Again"}
          </button>
        )}
      </div>

      {/* Sell success */}
      {sellSuccess && (
        <div style={{ marginBottom: 12, borderRadius: "var(--radius-sm)", border: "1px solid rgba(13,184,145,0.3)", backgroundColor: "var(--teal-dim)", padding: "10px 14px", fontSize: "0.8125rem", fontWeight: 500, color: "var(--teal)" }}>
          {zh ? "出售成功，收益已到账。" : "Sold — proceeds credited to your wallet."}
        </div>
      )}

      {/* Position cards */}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: hasYes && hasNo ? "1fr 1fr" : "1fr" }}>
        {hasYes && (
          <PositionCard
            label={upLabel}
            accent="var(--teal)"
            accentDim="var(--teal-dim)"
            accentBorder="rgba(13,184,145,0.3)"
            units={yesUnits}
            avgPrice={avgYesPrice}
            currentValue={yesCurrentValue}
            pnl={yesPnl}
            winPayout={yesUnits}
            sellSide={sellSide}
            side="yes"
            sellUnits={sellUnits}
            setSellUnits={setSellUnits}
            maxSellUnits={maxSellUnits}
            estimatedPayout={sellSide === "yes" ? estimatedPayout : null}
            selling={selling}
            sellError={sellSide === "yes" ? sellError : null}
            onOpenSell={() => openSell("yes")}
            onCloseSell={closeSell}
            onSubmitSell={handleSell}
            zh={zh}
          />
        )}
        {hasNo && (
          <PositionCard
            label={downLabel}
            accent="var(--rose)"
            accentDim="var(--rose-dim)"
            accentBorder="rgba(232,68,90,0.3)"
            units={noUnits}
            avgPrice={avgNoPrice}
            currentValue={noCurrentValue}
            pnl={noPnl}
            winPayout={noUnits}
            sellSide={sellSide}
            side="no"
            sellUnits={sellUnits}
            setSellUnits={setSellUnits}
            maxSellUnits={maxSellUnits}
            estimatedPayout={sellSide === "no" ? estimatedPayout : null}
            selling={selling}
            sellError={sellSide === "no" ? sellError : null}
            onOpenSell={() => openSell("no")}
            onCloseSell={closeSell}
            onSubmitSell={handleSell}
            zh={zh}
          />
        )}
      </div>
    </div>
  );
}

/* ── Individual position card ──────────────────────────────────────────────── */

type PositionCardProps = {
  label: string;
  accent: string;
  accentDim: string;
  accentBorder: string;
  units: number;
  avgPrice: number | null;
  currentValue: number | null;
  pnl: number | null;
  winPayout: number;
  side: "yes" | "no";
  sellSide: "yes" | "no" | null;
  sellUnits: string;
  setSellUnits: (v: string) => void;
  maxSellUnits: number;
  estimatedPayout: number | null;
  selling: boolean;
  sellError: string | null;
  onOpenSell: () => void;
  onCloseSell: () => void;
  onSubmitSell: (e: React.FormEvent) => void;
  zh: boolean;
};

function PositionCard({
  label, accent, accentDim, accentBorder,
  units, avgPrice, currentValue, pnl, winPayout,
  side, sellSide, sellUnits, setSellUnits, maxSellUnits,
  estimatedPayout, selling, sellError,
  onOpenSell, onCloseSell, onSubmitSell,
  zh,
}: PositionCardProps) {
  const fmt    = (n: number) => n.toFixed(2);
  const fmtPnl = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
  const sellUnitsNum = parseFloat(sellUnits);
  const isThisSell = sellSide === side;

  return (
    <div
      style={{
        borderRadius: "var(--radius-md)",
        border: `1px solid ${accentBorder}`,
        backgroundColor: accentDim,
        padding: "12px 14px",
      }}
    >
      {/* Label + sell button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: accent }}>
          {label}
        </span>
        {!isThisSell && (
          <button
            type="button"
            onClick={onOpenSell}
            style={{
              padding: "3px 10px",
              borderRadius: 100,
              border: `1px solid ${accentBorder}`,
              backgroundColor: "var(--bg-elevated)",
              color: accent,
              fontFamily: "var(--font-sans)",
              fontSize: "0.6875rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 150ms ease",
            }}
          >
            {zh ? "卖出" : "Sell"}
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.375rem", fontWeight: 700, color: accent, letterSpacing: "-0.02em" }}>
          {units.toFixed(4)}
          <span style={{ fontSize: "0.75rem", fontWeight: 500, marginLeft: 4, color: accent, opacity: 0.7 }}>
            {zh ? "份" : "units"}
          </span>
        </p>

        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
          {avgPrice != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
              <span style={{ color: "var(--text-dim)" }}>{zh ? "均价" : "Avg price"}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--text-secondary)" }}>${avgPrice.toFixed(3)}</span>
            </div>
          )}
          {currentValue != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
              <span style={{ color: "var(--text-dim)" }}>{zh ? "当前市值" : "Market value"}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>${fmt(currentValue)}</span>
            </div>
          )}
          {pnl != null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
              <span style={{ color: "var(--text-dim)" }}>{zh ? "浮盈亏" : "Unrealized"}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: pnl >= 0 ? "var(--teal)" : "var(--rose)" }}>{fmtPnl(pnl)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 4, marginTop: 2 }}>
            <span style={{ color: "var(--text-dim)" }}>{zh ? "赢得" : "If wins"}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: accent }}>${fmt(winPayout)}</span>
          </div>
        </div>
      </div>

      {/* Inline sell form */}
      {isThisSell && (
        <form
          onSubmit={onSubmitSell}
          style={{ borderTop: `1px solid ${accentBorder}`, paddingTop: 10, marginTop: 4 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {zh ? `卖出 ${label}` : `Sell ${label}`}
            </span>
            <button type="button" onClick={onCloseSell} style={{ fontSize: "0.75rem", color: "var(--text-dim)", cursor: "pointer", border: "none", backgroundColor: "transparent", padding: 2 }}>✕</button>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              min="0.0001"
              max={maxSellUnits}
              step="0.0001"
              value={sellUnits}
              onChange={(e) => setSellUnits(e.target.value)}
              placeholder={zh ? "数量" : "Units"}
              style={{
                flex: 1,
                height: 36,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-primary)",
                padding: "0 10px",
                fontSize: "0.875rem",
                fontFamily: "var(--font-mono)",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => setSellUnits(String(side === "yes" ? units : units))}
              style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-dim)", cursor: "pointer", border: "none", backgroundColor: "transparent", padding: "0 4px", whiteSpace: "nowrap" }}
            >
              {zh ? "全部" : "Max"}
            </button>
          </div>

          {estimatedPayout != null && (
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {zh ? "预计到账 " : "Proceeds "}<span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>${fmt(estimatedPayout)}</span>
            </p>
          )}

          {sellError && (
            <p style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--rose)" }}>{sellError}</p>
          )}

          <button
            type="submit"
            disabled={selling || isNaN(sellUnitsNum) || sellUnitsNum <= 0 || sellUnitsNum > maxSellUnits}
            style={{
              marginTop: 8,
              width: "100%",
              height: 36,
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: accent,
              color: "#070809",
              fontFamily: "var(--font-sans)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: selling ? "not-allowed" : "pointer",
              opacity: selling ? 0.6 : 1,
              transition: "opacity 150ms ease",
            }}
            className="active:scale-[0.97]"
          >
            {selling
              ? (zh ? "处理中…" : "Processing…")
              : zh
                ? `确认卖出 $${estimatedPayout != null ? fmt(estimatedPayout) : "—"}`
                : `Confirm sell · $${estimatedPayout != null ? fmt(estimatedPayout) : "—"}`}
          </button>
        </form>
      )}
    </div>
  );
}
