"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, TrendingUp, TrendingDown, MinusCircle, Loader2 } from "lucide-react";

import { useWallet } from "@/lib/contexts/wallet-context";
import type { Locale } from "@/lib/i18n/translations";

type Props = {
  marketId: string;
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
  outcome?: "yes" | "no" | "void";
};

/**
 * Polymarket-style "round closed" banner. Once the close_at time passes:
 *   • Shows that the round is over
 *   • Polls for the user's result (if they participated)
 *   • Displays win / loss + updated balance
 *   • Provides a manual "Trade next round →" button
 *
 * No auto-redirect — user stays on the page until they choose to leave.
 */
export function RoundClosedBanner({ marketId, closeAt, isShortDuration, locale }: Props) {
  const router = useRouter();
  const { wallet, refetch: refetchWallet } = useWallet();
  const [isClosed, setIsClosed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Detect when the round closes
  useEffect(() => {
    if (!isShortDuration) return;
    const closeMs = new Date(closeAt).getTime();

    const check = () => {
      if (Date.now() >= closeMs) {
        setIsClosed(true);
        return true;
      }
      return false;
    };
    if (check()) return;

    const id = window.setInterval(() => {
      if (check()) window.clearInterval(id);
    }, 1_000);
    return () => window.clearInterval(id);
  }, [closeAt, isShortDuration]);

  // Once closed, poll for the user's result until settled (or timeout after ~30s)
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
            // If the user participated and result is final, refresh wallet
            if (json.participated && json.settled && !json.pending) {
              void refetchWallet();
              return; // stop polling
            }
          }
        }
      } catch {
        // ignore
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

  if (!isClosed) return null;

  // ---------------------------------------------------------------------------
  // Result rendering
  // ---------------------------------------------------------------------------

  const participated = result?.participated === true;
  const settling = result == null || (participated && result.pending === true);
  const isWin = result?.isWin === true;
  const isVoid = result?.outcome === "void";
  const pnlNum = result?.pnlAmount ? parseFloat(result.pnlAmount) : 0;

  // Color scheme based on outcome
  const palette = !participated
    ? { border: "border-slate-200", bg: "from-slate-50 to-slate-100", icon: "text-slate-500", iconBg: "bg-slate-100" }
    : settling
      ? { border: "border-yellow-300", bg: "from-yellow-50 to-amber-50", icon: "text-yellow-700", iconBg: "bg-yellow-100" }
      : isWin
        ? { border: "border-green-300", bg: "from-green-50 to-emerald-50", icon: "text-green-700", iconBg: "bg-green-100" }
        : isVoid
          ? { border: "border-slate-300", bg: "from-slate-50 to-slate-100", icon: "text-slate-600", iconBg: "bg-slate-100" }
          : { border: "border-red-300", bg: "from-red-50 to-rose-50", icon: "text-red-700", iconBg: "bg-red-100" };

  // Title + subtitle based on state
  let title: string;
  let subtitle: string | null = null;
  let Icon: typeof TrendingUp = MinusCircle;

  if (!participated) {
    title = locale === "zh" ? "本轮已结束" : "Round closed";
    subtitle = locale === "zh" ? "下一轮已开始 — 立即交易" : "Next round is live — trade now";
  } else if (settling) {
    title = locale === "zh" ? "结算中..." : "Settling…";
    subtitle = locale === "zh" ? "正在计算您的结果" : "Calculating your result";
  } else if (isVoid) {
    title = locale === "zh" ? "本轮无效" : "Round voided";
    subtitle = locale === "zh" ? "您的投注已退回" : "Your stake was refunded";
  } else if (isWin) {
    Icon = TrendingUp;
    title = locale === "zh" ? `您赢了 $${pnlNum.toFixed(2)}` : `You won $${pnlNum.toFixed(2)}`;
    subtitle =
      wallet != null
        ? locale === "zh"
          ? `新余额: $${parseFloat(wallet.balance).toFixed(2)}`
          : `New balance: $${parseFloat(wallet.balance).toFixed(2)}`
        : null;
  } else {
    Icon = TrendingDown;
    title = locale === "zh" ? `您输了 $${Math.abs(pnlNum).toFixed(2)}` : `You lost $${Math.abs(pnlNum).toFixed(2)}`;
    subtitle =
      wallet != null
        ? locale === "zh"
          ? `新余额: $${parseFloat(wallet.balance).toFixed(2)}`
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
        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
        >
          {locale === "zh" ? "交易下一轮" : "Trade next round"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
