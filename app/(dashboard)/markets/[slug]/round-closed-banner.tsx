"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Loader2, MinusCircle, TrendingDown, TrendingUp } from "lucide-react";

import { useWallet } from "@/lib/contexts/wallet-context";
import type { Locale } from "@/lib/i18n/translations";

type Props = {
  marketId: string;
  assetSymbol: string;
  closeAt: string;
  isShortDuration: boolean;
  durationMinutes?: number | null;
  locale: Locale;
};

type Result = {
  participated: boolean;
  pending?: boolean;
  settled?: boolean;
  isWin?: boolean;
  pnlAmount?: string;
  outcome?: "yes" | "no" | "void" | "cancelled";
};

/**
 * Permanent ended-round banner. It shows settlement/result state and lets the
 * user explicitly jump into the current live market for the same asset.
 */
export function RoundClosedBanner({ marketId, assetSymbol, closeAt, isShortDuration, durationMinutes, locale }: Props) {
  const { wallet, refetch: refetchWallet } = useWallet();
  const [isClosed, setIsClosed] = useState(() => (
    isShortDuration && Date.now() >= new Date(closeAt).getTime()
  ));
  const [result, setResult] = useState<Result | null>(null);
  const [isFindingLiveMarket, setIsFindingLiveMarket] = useState(false);
  const [liveMarketError, setLiveMarketError] = useState<string | null>(null);

  useEffect(() => {
    if (!isShortDuration) return;
    const closeMs = new Date(closeAt).getTime();

    const check = () => {
      if (Date.now() >= closeMs) {
        setIsClosed(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return true;
      }
      return false;
    };

    if (!check()) {
      setIsClosed(false);
      setResult(null);
      setLiveMarketError(null);
    } else {
      return;
    }

    const id = window.setInterval(() => {
      if (check()) window.clearInterval(id);
    }, 1_000);

    return () => window.clearInterval(id);
  }, [closeAt, isShortDuration, marketId]);

  useEffect(() => {
    if (!isClosed) return;

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const fetchResult = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/markets/${marketId}/my-result`, { cache: "no-store" });
        if (res.ok) {
          const json = (await res.json()) as Result & { success: boolean };
          if (json.success) {
            setResult(json);
            if (json.participated && json.settled && !json.pending) {
              void refetchWallet();
              return;
            }
          }
        }
      } catch {
        // Keep the banner visible even if result polling briefly fails.
      }

      attempts += 1;
      if (attempts < 15 && !stopped) {
        timer = setTimeout(fetchResult, 2_000);
      }
    };

    void fetchResult();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [isClosed, marketId, refetchWallet]);

  const goToLiveMarket = async () => {
    setIsFindingLiveMarket(true);
    setLiveMarketError(null);

    try {
      const durationQuery = durationMinutes != null ? `&duration=${durationMinutes}` : "";
      const res = await fetch(`/api/markets/active?asset=${encodeURIComponent(assetSymbol)}${durationQuery}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { success?: boolean; slug?: string; message?: string };

      if (!res.ok || !json.success || !json.slug) {
        throw new Error(json.message ?? "No live market is available yet.");
      }

      // Hard navigation — bypasses Next.js router cache so the new round's
      // server data is always fetched fresh, never served stale.
      window.location.href = `/markets/${json.slug}`;
    } catch (err) {
      setLiveMarketError(
        err instanceof Error
          ? err.message
          : locale === "zh"
            ? "\u73b0\u5728\u6ca1\u6709\u53ef\u4ea4\u6613\u7684\u5e02\u573a\u3002"
            : "No live market is available yet.",
      );
    } finally {
      setIsFindingLiveMarket(false);
    }
  };

  if (!isClosed) return null;

  const participated = result?.participated === true;
  const settling = result == null || (participated && result.pending === true);
  const isWin = result?.isWin === true;
  const isVoid = result?.outcome === "void" || result?.outcome === "cancelled";
  const pnlNum = result?.pnlAmount ? parseFloat(result.pnlAmount) : 0;

  const palette = !participated
    ? { borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)", iconColor: "var(--text-dim)", iconBgColor: "var(--bg-surface)", accentColor: "var(--text-secondary)" }
    : settling
      ? { borderColor: "var(--border-gold)", backgroundColor: "var(--gold-dim)", iconColor: "var(--gold)", iconBgColor: "rgba(232,160,32,0.15)", accentColor: "var(--gold)" }
      : isWin
        ? { borderColor: "rgba(13,184,145,0.35)", backgroundColor: "var(--teal-dim)", iconColor: "var(--teal)", iconBgColor: "rgba(13,184,145,0.15)", accentColor: "var(--teal)" }
        : isVoid
          ? { borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)", iconColor: "var(--text-dim)", iconBgColor: "var(--bg-surface)", accentColor: "var(--text-secondary)" }
          : { borderColor: "rgba(232,68,90,0.35)", backgroundColor: "var(--rose-dim)", iconColor: "var(--rose)", iconBgColor: "rgba(232,68,90,0.15)", accentColor: "var(--rose)" };

  let title: string;
  let subtitle: string | null = null;
  let Icon: typeof TrendingUp = MinusCircle;

  if (!participated) {
    title = locale === "zh" ? "\u672c\u8f6e\u5df2\u7ed3\u675f" : "Round ended";
    subtitle = locale === "zh"
      ? "\u70b9\u51fb\u8fdb\u5165\u5f53\u524d\u53ef\u4ea4\u6613\u7684\u8f6e\u6b21"
      : "Choose when to enter the current live round.";
  } else if (settling) {
    title = locale === "zh" ? "\u7ed3\u7b97\u4e2d..." : "Settling...";
    subtitle = locale === "zh" ? "\u6b63\u5728\u8ba1\u7b97\u60a8\u7684\u7ed3\u679c" : "Calculating your result";
  } else if (isVoid) {
    title = locale === "zh" ? "\u672c\u8f6e\u65e0\u6548" : "Round voided";
    subtitle = locale === "zh" ? "\u60a8\u7684\u6295\u6ce8\u5df2\u9000\u56de" : "Your stake was refunded";
  } else if (isWin) {
    Icon = TrendingUp;
    title = locale === "zh" ? `\u60a8\u8d62\u4e86 $${pnlNum.toFixed(2)}` : `You won $${pnlNum.toFixed(2)}`;
    subtitle =
      wallet != null
        ? locale === "zh"
          ? `\u65b0\u4f59\u989d: $${parseFloat(wallet.balance).toFixed(2)}`
          : `New balance: $${parseFloat(wallet.balance).toFixed(2)}`
        : null;
  } else {
    Icon = TrendingDown;
    title = locale === "zh" ? `\u60a8\u8f93\u4e86 $${Math.abs(pnlNum).toFixed(2)}` : `You lost $${Math.abs(pnlNum).toFixed(2)}`;
    subtitle =
      wallet != null
        ? locale === "zh"
          ? `\u65b0\u4f59\u989d: $${parseFloat(wallet.balance).toFixed(2)}`
          : `New balance: $${parseFloat(wallet.balance).toFixed(2)}`
        : null;
  }

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${palette.borderColor}`, backgroundColor: palette.backgroundColor, padding: 16 }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, flexShrink: 0, borderRadius: "50%", backgroundColor: palette.iconBgColor }}>
            {settling ? (
              <Loader2 style={{ width: 16, height: 16, color: palette.iconColor }} className="animate-spin" />
            ) : (
              <Icon style={{ width: 16, height: 16, color: palette.iconColor }} />
            )}
          </div>
          <div>
            <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
            {subtitle && <p style={{ marginTop: 2, fontSize: "0.875rem", color: "var(--text-secondary)" }}>{subtitle}</p>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={goToLiveMarket}
            disabled={isFindingLiveMarket}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-void)",
              padding: "8px 16px",
              fontSize: "0.875rem", fontWeight: 600, fontFamily: "var(--font-sans)",
              color: "var(--text-primary)",
              cursor: isFindingLiveMarket ? "not-allowed" : "pointer",
              opacity: isFindingLiveMarket ? 0.6 : 1,
              transition: "background-color 150ms ease",
            }}
          >
            {isFindingLiveMarket
              ? locale === "zh" ? "\u67e5\u627e\u4e2d..." : "Finding live market..."
              : locale === "zh" ? "\u4ea4\u6613\u5b9e\u65f6\u5e02\u573a" : "Trade live market"}
            {isFindingLiveMarket ? (
              <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
            ) : (
              <ChevronRight style={{ width: 16, height: 16 }} />
            )}
          </button>
        </div>
      </div>
      {liveMarketError && (
        <p style={{ marginTop: 12, fontSize: "0.875rem", fontWeight: 500, color: "var(--rose)" }}>{liveMarketError}</p>
      )}
    </div>
  );
}
