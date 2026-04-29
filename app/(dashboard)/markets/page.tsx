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

  return (
    <div className="space-y-8">
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
                  <Card className="relative h-full overflow-hidden border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] shadow-lg shadow-slate-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/90">
                    <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(90deg,rgba(16,185,129,0.10),rgba(255,255,255,0),rgba(244,63,94,0.10))]" />
                    <div className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 ring-1 ring-slate-200">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="relative p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">
                            {t.short_duration_badge}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            {t.live_contract}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {market.assetSymbol}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            market.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {statusLabel(market.status, locale)}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
                        <div>
                          <h3 className="text-lg font-semibold leading-tight text-slate-950 sm:text-xl">
                            {locale === "zh" && market.titleZh ? market.titleZh : market.title}
                          </h3>
                          <p className="mt-3 max-w-xl text-sm text-slate-500">
                            {t.target_price_label}{" "}
                            <span className="font-semibold text-slate-950">
                              {formatTargetPrice(market.spotPriceAtOpen)}
                            </span>
                          </p>
                          <div className="mt-5 max-w-md">
                            <ProbabilityBar
                              yesPrice={market.yesPrice}
                              positiveLabel={positiveLabel}
                              negativeLabel={negativeLabel}
                            />
                          </div>
                          <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-slate-700">
                            {t.trade_now} <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="grid gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 backdrop-blur">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">{t.closes}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {new Date(market.closeAt).toLocaleDateString(dateLocale, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4">
                              <p className="text-[11px] uppercase tracking-wide text-emerald-700">{positiveLabel}</p>
                              <p className="mt-1 text-2xl font-bold text-emerald-700">
                                {market.yesPrice != null ? `$${formatDecimal(market.yesPrice, 2)}` : "-"}
                              </p>
                              <p className="mt-2 text-xs font-medium text-emerald-700/80">{t.quick_entry}</p>
                            </div>
                            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4">
                              <p className="text-[11px] uppercase tracking-wide text-rose-700">{negativeLabel}</p>
                              <p className="mt-1 text-2xl font-bold text-rose-700">
                                {market.noPrice != null ? `$${formatDecimal(market.noPrice, 2)}` : "-"}
                              </p>
                              <p className="mt-2 text-xs font-medium text-rose-700/80">{t.quick_entry}</p>
                            </div>
                          </div>
                        </div>
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
