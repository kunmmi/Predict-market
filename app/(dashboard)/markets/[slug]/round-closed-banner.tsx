"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, MinusCircle, TrendingDown, TrendingUp } from "lucide-react";

import { useWallet } from "@/lib/contexts/wallet-context";
import type { Locale } from "@/lib/i18n/translations";

type Props = {
  marketId: string;
  assetSymbol: string;
  closeAt: string;
  isShortDuration: boolean;
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
export function RoundClosedBanner({ marketId, assetSymbol, closeAt, isShortDuration, locale }: Props) {
  const router = useRouter();
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
      const res = await fetch(`/api/markets/active?asset=${encodeURIComponent(assetSymbol)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as { success?: boolean; slug?: string; message?: string };

      if (!res.ok || !json.success || !json.slug) {
        throw new Error(json.message ?? "No live market is available yet.");
      }

      router.push(`/markets/${json.slug}`);
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
    ? { border: "border-slate-200", bg: "from-slate-50 to-slate-100", icon: "text-slate-500", iconBg: "bg-slate-100" }
    : settling
      ? { border: "border-yellow-300", bg: "from-yellow-50 to-amber-50", icon: "text-yellow-700", iconBg: "bg-yellow-100" }
      : isWin
        ? { border: "border-green-300", bg: "from-green-50 to-emerald-50", icon: "text-green-700", iconBg: "bg-green-100" }
        : isVoid
          ? { border: "border-slate-300", bg: "from-slate-50 to-slate-100", icon: "text-slate-600", iconBg: "bg-slate-100" }
          : { border: "border-red-300", bg: "from-red-50 to-rose-50", icon: "text-red-700", iconBg: "bg-red-100" };

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
    <div className={`rounded-xl border ${palette.border} bg-gradient-to-r ${palette.bg} p-4 shadow-sm`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${palette.iconBg}`}>
            {settling ? (
              <Loader2 className={`h-4 w-4 animate-spin ${palette.icon}`} />
            ) : (
              <Icon className={`h-4 w-4 ${palette.icon}`} />
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{title}</p>
            {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToLiveMarket}
            disabled={isFindingLiveMarket}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isFindingLiveMarket
              ? locale === "zh" ? "\u67e5\u627e\u4e2d..." : "Finding live market..."
              : locale === "zh" ? "\u4ea4\u6613\u5b9e\u65f6\u5e02\u573a" : "Trade live market"}
            {isFindingLiveMarket ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      {liveMarketError && (
        <p className="mt-3 text-sm font-medium text-red-700">{liveMarketError}</p>
      )}
    </div>
  );
}
