import Link from "next/link";
import { TrendingUp, Clock, ChevronRight } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { getActiveMarkets } from "@/lib/services/market-data";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { sideLabel, statusLabel } from "@/lib/i18n/labels";
import type { Locale } from "@/lib/i18n/translations";
import { Card } from "@/components/ui/card";
import { MarketsAutoRefresh } from "./markets-auto-refresh";

function ProbabilityBar({
  yesPrice,
  positiveLabel,
  negativeLabel,
}: {
  yesPrice: string | null;
  positiveLabel: string;
  negativeLabel: string;
}) {
  const yes = yesPrice != null ? Math.min(100, Math.max(0, parseFloat(yesPrice) * 100)) : 50;
  const no = 100 - yes;

  return (
    <div className="mt-3 space-y-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="bg-green-500 transition-all" style={{ width: `${yes}%` }} />
        <div className="bg-red-400 transition-all" style={{ width: `${no}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>
          {yes.toFixed(0)}% {positiveLabel}
        </span>
        <span>
          {no.toFixed(0)}% {negativeLabel}
        </span>
      </div>
    </div>
  );
}

function formatTargetPrice(value: string | null): string {
  if (value == null) return "-";
  return `$${formatDecimal(value, 2)}`;
}

function shortDurationLabels(locale: Locale) {
  return {
    positive: locale === "zh" ? "看涨" : "UP",
    negative: locale === "zh" ? "看跌" : "DOWN",
  };
}

export default async function MarketsPage() {
  await requireUser();
  const markets = await getActiveMarkets();
  const locale = getLocale();
  const t = getT(locale).markets;
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";
  const hasShortDurationMarkets = markets.some((market) => market.durationMinutes != null);

  return (
    <div className="space-y-8">
      <MarketsAutoRefresh enabled={hasShortDurationMarkets} />
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">{t.subtitle}</p>
      </div>

      {markets.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-20 text-center">
          <TrendingUp className="mb-4 h-12 w-12 text-slate-300" />
          <p className="text-base font-semibold text-slate-700">{t.no_markets}</p>
          <p className="mt-1 text-sm text-slate-400">{t.no_markets_sub}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => {
            const isShortDuration = market.durationMinutes != null;
            const liveLabels = shortDurationLabels(locale);
            const positiveLabel = isShortDuration ? liveLabels.positive : sideLabel("yes", locale);
            const negativeLabel = isShortDuration ? liveLabels.negative : sideLabel("no", locale);

            return (
              <Link key={market.id} href={`/markets/${market.slug}`} className="group block">
                {isShortDuration ? (
                  <Card className="relative h-full overflow-hidden border-slate-900/90 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.26),transparent_24%),linear-gradient(160deg,#0f172a_0%,#111827_44%,#1f2937_100%)] shadow-[0_20px_50px_-24px_rgba(15,23,42,0.85)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-700 hover:shadow-[0_28px_64px_-28px_rgba(15,23,42,0.92)]">
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_32%,rgba(255,255,255,0.02)_100%)]" />
                    <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-emerald-400/20 blur-2xl" />
                    <div className="relative p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-100 backdrop-blur-sm">
                          <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                            <span className="absolute h-5 w-5 rounded-full bg-emerald-400/25 animate-ping" />
                            <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
                          </span>
                          Live round
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            market.status === "active"
                              ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                              : "border border-white/10 bg-white/8 text-slate-300"
                          }`}
                        >
                          {statusLabel(market.status, locale)}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                          {t.short_duration_badge}
                        </span>
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                          {t.live_contract}
                        </span>
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-100">
                          {market.assetSymbol}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_148px] md:items-start">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-white">
                            {locale === "zh" && market.titleZh ? market.titleZh : market.title}
                          </h3>
                          <div className="mt-3 rounded-2xl border border-white/8 bg-white/5 px-3.5 py-3 backdrop-blur-sm">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                              {t.target_price_label}
                            </p>
                            <p className="mt-1 text-lg font-semibold text-white">
                              {formatTargetPrice(market.spotPriceAtOpen)}
                            </p>
                          </div>
                          <div className="mt-3 max-w-md">
                            <ProbabilityBar
                              yesPrice={market.yesPrice}
                              positiveLabel={positiveLabel}
                              negativeLabel={negativeLabel}
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/7 p-3.5 backdrop-blur-sm">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{t.closes}</p>
                          <p className="mt-2 text-sm font-semibold leading-snug text-white">
                            {new Date(market.closeAt).toLocaleDateString(dateLocale, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">
                              {positiveLabel}
                            </p>
                            <ChevronRight className="h-4 w-4 text-emerald-200/80 transition-transform group-hover:translate-x-0.5" />
                          </div>
                          <p className="mt-2 text-[1.85rem] font-bold leading-none text-emerald-100">
                            {market.yesPrice != null ? `$${formatDecimal(market.yesPrice, 2)}` : "-"}
                          </p>
                          <p className="mt-2 text-xs font-medium text-emerald-200/80">{t.quick_entry}</p>
                        </div>
                        <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-rose-200">
                              {negativeLabel}
                            </p>
                            <ChevronRight className="h-4 w-4 text-rose-200/80 transition-transform group-hover:translate-x-0.5" />
                          </div>
                          <p className="mt-2 text-[1.85rem] font-bold leading-none text-rose-100">
                            {market.noPrice != null ? `$${formatDecimal(market.noPrice, 2)}` : "-"}
                          </p>
                          <p className="mt-2 text-xs font-medium text-rose-200/80">{t.quick_entry}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3 text-sm">
                        <span className="text-slate-300">{t.trade_now}</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-200">
                          {positiveLabel} / {negativeLabel} <ChevronRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="h-full p-5 transition-colors hover:border-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {market.assetSymbol}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          market.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {statusLabel(market.status, locale)}
                      </span>
                    </div>

                    <h3 className="mt-3 text-sm font-semibold leading-snug text-slate-900 line-clamp-2">
                      {locale === "zh" && market.titleZh ? market.titleZh : market.title}
                    </h3>

                    <div className="mt-4 flex gap-4">
                      <div>
                        <p className="text-xs text-slate-400">YES</p>
                        <p className="mt-0.5 text-base font-bold text-green-600">
                          {market.yesPrice != null ? `$${formatDecimal(market.yesPrice, 2)}` : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">NO</p>
                        <p className="mt-0.5 text-base font-bold text-red-500">
                          {market.noPrice != null ? `$${formatDecimal(market.noPrice, 2)}` : "-"}
                        </p>
                      </div>
                    </div>

                    <ProbabilityBar
                      yesPrice={market.yesPrice}
                      positiveLabel={positiveLabel}
                      negativeLabel={negativeLabel}
                    />

                    <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>
                        {t.closes}{" "}
                        {new Date(market.closeAt).toLocaleDateString(dateLocale, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-yellow-600 opacity-0 transition-opacity group-hover:opacity-100">
                      {t.trade_now} <ChevronRight className="h-3 w-3" />
                    </div>
                  </Card>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
