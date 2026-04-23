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

function ProbabilityBar({ yesPrice, locale }: { yesPrice: string | null; locale: Locale }) {
  const yes = yesPrice != null ? Math.min(100, Math.max(0, parseFloat(yesPrice) * 100)) : 50;
  const no = 100 - yes;
  return (
    <div className="mt-3 space-y-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="bg-green-500 transition-all" style={{ width: `${yes}%` }} />
        <div className="bg-red-400 transition-all" style={{ width: `${no}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{yes.toFixed(0)}% {sideLabel("yes", locale)}</span>
        <span>{no.toFixed(0)}% {sideLabel("no", locale)}</span>
      </div>
    </div>
  );
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
          {markets.map((market) => (
            <Link key={market.id} href={`/markets/${market.slug}`} className="group block">
              <Card className="h-full p-5 transition-colors hover:border-slate-300">
                {/* Top row: asset badge + status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {market.assetSymbol}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      market.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {statusLabel(market.status, locale)}
                  </span>
                </div>

                {/* Title */}
                <h3 className="mt-3 text-sm font-semibold leading-snug text-slate-900 line-clamp-2">
                  {locale === "zh" && market.titleZh ? market.titleZh : market.title}
                </h3>

                {/* Prices */}
                <div className="mt-4 flex gap-4">
                  <div>
                    <p className="text-xs text-slate-400">YES</p>
                    <p className="mt-0.5 text-base font-bold text-green-600">
                      {market.yesPrice != null ? `$${formatDecimal(market.yesPrice, 2)}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">NO</p>
                    <p className="mt-0.5 text-base font-bold text-red-500">
                      {market.noPrice != null ? `$${formatDecimal(market.noPrice, 2)}` : "—"}
                    </p>
                  </div>
                </div>

                {/* Probability bar */}
                <ProbabilityBar yesPrice={market.yesPrice} locale={locale} />

                {/* Close date */}
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

                {/* CTA hint */}
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-yellow-600 opacity-0 transition-opacity group-hover:opacity-100">
                  {t.trade_now} <ChevronRight className="h-3 w-3" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
