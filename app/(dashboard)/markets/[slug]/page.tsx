import { notFound } from "next/navigation";
import { TrendingUp, TrendingDown, Clock, CheckCircle } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { getMarketBySlug } from "@/lib/services/market-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { TradeForm } from "./trade-form";

type Props = {
  params: { slug: string };
};

function ProbabilityBar({
  yesPrice,
  probYes,
  probNo,
}: {
  yesPrice: string | null;
  probYes: string;
  probNo: string;
}) {
  const yes = yesPrice != null ? Math.min(100, Math.max(0, parseFloat(yesPrice) * 100)) : 50;
  const no = 100 - yes;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="bg-green-500 transition-all" style={{ width: `${yes}%` }} />
        <div className="bg-red-400 transition-all" style={{ width: `${no}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span className="font-medium text-green-600">{yes.toFixed(1)}% {probYes}</span>
        <span className="font-medium text-red-500">{no.toFixed(1)}% {probNo}</span>
      </div>
    </div>
  );
}

export default async function MarketDetailPage({ params }: Props) {
  await requireUser();

  const market = await getMarketBySlug(params.slug);
  if (!market) notFound();

  const locale = getLocale();
  const t = getT(locale);
  const tm = t.market_detail;
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";

  const isActive = market.status === "active";
  const isSettled = market.status === "settled";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {market.assetSymbol}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isActive
                ? "bg-green-100 text-green-700"
                : isSettled
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
          </span>
          {market.resolutionOutcome !== "unresolved" && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                market.resolutionOutcome === "yes"
                  ? "bg-green-100 text-green-800"
                  : market.resolutionOutcome === "no"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              <CheckCircle className="h-3 w-3" />
              {tm.resolved_label} {market.resolutionOutcome.toUpperCase()}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {locale === "zh" && market.titleZh ? market.titleZh : market.title}
        </h1>
        {market.questionText && market.questionText !== market.title && (
          <p className="mt-1.5 text-base text-slate-500">
            {locale === "zh" && market.questionTextZh ? market.questionTextZh : market.questionText}
          </p>
        )}
      </div>

      {/* Probability bar */}
      <Card className="p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {tm.current_probability}
        </p>
        <ProbabilityBar
          yesPrice={market.latestYesPrice}
          probYes={tm.prob_yes}
          probNo={tm.prob_no}
        />
      </Card>

      {/* Price + Date cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tm.yes_price}</p>
                <p className="mt-1.5 text-2xl font-bold text-green-600 tabular-nums">
                  {market.latestYesPrice != null
                    ? `$${formatDecimal(market.latestYesPrice, 2)}`
                    : "—"}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tm.no_price}</p>
                <p className="mt-1.5 text-2xl font-bold text-red-500 tabular-nums">
                  {market.latestNoPrice != null
                    ? `$${formatDecimal(market.latestNoPrice, 2)}`
                    : "—"}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tm.closes}</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {new Date(market.closeAt).toLocaleDateString(dateLocale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <Clock className="h-4 w-4 text-slate-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade form */}
      <TradeForm
        marketId={market.id}
        yesPrice={market.latestYesPrice}
        noPrice={market.latestNoPrice}
        marketStatus={market.status}
        t={t.trade}
      />

      {/* Description */}
      {(market.description || market.descriptionZh) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{tm.about}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {locale === "zh" && market.descriptionZh ? market.descriptionZh : market.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rules */}
      {(market.rulesText || market.rulesTextZh) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{tm.rules}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {locale === "zh" && market.rulesTextZh ? market.rulesTextZh : market.rulesText}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resolution */}
      {market.resolutionNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">{tm.resolution_notes}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{market.resolutionNotes}</p>
            {market.resolvedAt && (
              <p className="mt-2 text-xs text-slate-400">
                {tm.resolved_on}{" "}
                {new Date(market.resolvedAt).toLocaleDateString(dateLocale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
