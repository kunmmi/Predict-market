export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Clock, CheckCircle } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { getMarketByIdAdmin, getMarketBySlug, getMarketPriceHistory } from "@/lib/services/market-data";
import { settleShortDurationMarketById, ensureRoundOpeningPrice } from "@/lib/services/short-duration-settlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { statusLabel } from "@/lib/i18n/labels";
import { resolveMarketTitle } from "@/lib/short-duration-predictions";
import { cryptoIconUrl, hasCryptoIcon } from "@/lib/helpers/crypto-icon";
import { getRoundHistory, ensureUpcomingRound } from "@/lib/services/round-history";
import LiveCryptoChart from "@/components/ui/live-crypto-chart";
import { RoundSelectorBar } from "@/components/markets/round-selector-bar";
import { UpcomingRoundRedirector } from "./upcoming-round-redirector";
import { TradeArea } from "./trade-area";
import { PriceHistoryChart } from "./price-history-chart";
import { LiveProbabilityBar } from "./live-probability-bar";
import { RoundClosedBanner } from "./round-closed-banner";
import { OrderBookPanel } from "./order-book-panel";

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
  const [{ profile }, fetchedMarket] = await Promise.all([
    requireUser(),
    getMarketBySlug(params.slug),
  ]);
  if (!fetchedMarket) {
    // If the slug looks like a timestamped upcoming slug (e.g. btc-5min-20240528102000)
    // it may have been promoted to the base slug when the round went live.
    // Redirect to the base slug so the user doesn't get a hard 404.
    const maybeBase = params.slug.replace(/-\d{14}$/, "");
    if (maybeBase !== params.slug) {
      const baseMarket = await getMarketBySlug(maybeBase);
      if (baseMarket) redirect(`/markets/${maybeBase}`);
    }
    notFound();
  }
  let market = fetchedMarket;

  if (market.durationMinutes != null) {
    const isExpired = new Date(market.closeAt) <= new Date();

    if (market.status === "active" && isExpired) {
      // Active but window closed: settle it, then keep the user on the
      // ended-round experience instead of redirecting them away.
      const result = await settleShortDurationMarketById(market.id);
      const refreshed = result.success ? await getMarketByIdAdmin(market.id) : null;
      if (refreshed) {
        market = refreshed;
      }
    }

    // For the active round now in hand, silently validate that spot_price_at_open
    // matches the real Binance price for the round's start minute. Repairs any stale
    // value in the DB before it reaches the chart, probability bar, or trade API.
    //
    // Guard: only run this for rounds that have ALREADY started. Upcoming (future)
    // rounds must keep spot_price_at_open = null so the trade form shows 50/50 odds.
    // Calling this with a future start time would fall back to the current spot price
    // and corrupt the upcoming round's pricing.
    const roundStartAlreadyPassedMs =
      market.durationMinutes != null
        ? new Date(market.closeAt).getTime() - market.durationMinutes * 60_000
        : null;
    if (
      market.status === "active" &&
      market.durationMinutes != null &&
      new Date(market.closeAt) > new Date() &&
      roundStartAlreadyPassedMs != null &&
      roundStartAlreadyPassedMs <= Date.now()
    ) {
      const validatedPrice = await ensureRoundOpeningPrice({
        id: market.id,
        assetSymbol: market.assetSymbol,
        closeAt: market.closeAt,
        durationMinutes: market.durationMinutes,
        spotPriceAtOpen: market.spotPriceAtOpen,
      });
      if (validatedPrice != null) {
        market = { ...market, spotPriceAtOpen: String(validatedPrice) };
      }
    }
  }

  const priceHistory = await getMarketPriceHistory(market.id);

  const locale = getLocale();
  const t = getT(locale);
  const tm = t.market_detail;
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";
  const isShortDuration = market.durationMinutes != null;
  const positiveLabel = isShortDuration ? (locale === "zh" ? "看涨" : "UP") : tm.yes_price;
  const negativeLabel = isShortDuration ? (locale === "zh" ? "看跌" : "DOWN") : tm.no_price;

  const isActive = market.status === "active";
  const isSettled = market.status === "settled";

  // Detect if this is an upcoming (not-yet-started) round:
  // active + short-duration + openAt still in the future
  const roundOpenAtMs = isShortDuration && market.durationMinutes != null
    ? new Date(market.closeAt).getTime() - market.durationMinutes * 60_000
    : null;
  const isUpcoming = isActive && isShortDuration && roundOpenAtMs != null && roundOpenAtMs > Date.now();

  // If this is an upcoming round that somehow got a spot_price_at_open written to it
  // (from the bug where ensureRoundOpeningPrice used to run for future rounds), clear
  // it so the trade form uses 50/50 pricing. Also scrub it from the DB silently.
  if (isUpcoming && market.spotPriceAtOpen != null) {
    market = { ...market, spotPriceAtOpen: null };
    const supabaseAdmin = createSupabaseAdminClient();
    void supabaseAdmin
      .from("markets")
      .update({ spot_price_at_open: null })
      .eq("id", market.id)
      .then(() => undefined);
  }

  // Pre-create the next 2 upcoming rounds FIRST, then fetch history so it
  // always sees the newly-created rows. Running them in parallel meant the
  // history query completed before the inserts, giving 0 upcoming rounds on
  // the first visit and falling back to unclickable calculated slots.
  const baseSlug = market.slug.replace(/-\d{14}$/, "");
  const nextCloseAt1 = market.durationMinutes != null
    ? new Date(new Date(market.closeAt).getTime() + market.durationMinutes * 60_000).toISOString()
    : null;

  if (isShortDuration && isActive && !isUpcoming && market.durationMinutes != null) {
    await Promise.all([
      ensureUpcomingRound({
        baseSlug,
        currentCloseAt: market.closeAt,
        durationMinutes: market.durationMinutes,
        assetSymbol: market.assetSymbol,
        createdBy: profile.id,
      }).catch(() => null),
      nextCloseAt1 != null
        ? ensureUpcomingRound({
            baseSlug,
            currentCloseAt: nextCloseAt1,
            durationMinutes: market.durationMinutes,
            assetSymbol: market.assetSymbol,
            createdBy: profile.id,
          }).catch(() => null)
        : Promise.resolve(null),
    ]);
  }

  const roundHistory = isShortDuration && market.durationMinutes != null
    ? await getRoundHistory(baseSlug, market.durationMinutes)
    : null;

  // Build calculated fallback slots for any upcoming positions not yet in DB
  const calculatedSlots = (() => {
    if (!isShortDuration || !market.durationMinutes) return [];
    const dur = market.durationMinutes * 60_000;
    const upcomingCount = roundHistory?.upcoming.length ?? 0;
    // We want to show 3 upcoming slots total; fill the remainder with calculated ones
    const needed = Math.max(0, 3 - upcomingCount);
    const slots: { closeAt: string; openAt: string }[] = [];
    for (let i = 0; i < needed; i++) {
      const base = new Date(market.closeAt).getTime();
      const closeMs = base + dur * (upcomingCount + i + 1);
      slots.push({
        closeAt: new Date(closeMs).toISOString(),
        openAt: new Date(closeMs - dur).toISOString(),
      });
    }
    return slots;
  })();

  return (
    <div className="space-y-6">
      {/* Silently redirect upcoming rounds to base slug the moment they go live */}
      {isUpcoming && roundOpenAtMs != null && (
        <UpcomingRoundRedirector
          openAt={new Date(roundOpenAtMs).toISOString()}
          baseSlug={baseSlug}
        />
      )}

      {/* Round-closed banner (only appears once the close_at time passes) */}
      <RoundClosedBanner
        key={market.id}
        marketId={market.id}
        assetSymbol={market.assetSymbol}
        closeAt={market.closeAt}
        isShortDuration={isShortDuration}
        locale={locale}
      />

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          {hasCryptoIcon(market.assetSymbol) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cryptoIconUrl(market.assetSymbol)}
              alt={market.assetSymbol}
              width={48}
              height={48}
              className="rounded-full shadow-md"
            />
          )}
          <div>
            <p className="text-lg font-extrabold text-slate-900">{market.assetSymbol}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isActive
                    ? "bg-green-100 text-green-700"
                    : isSettled
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {statusLabel(market.status, locale)}
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
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {resolveMarketTitle(locale, market.title, market.titleZh, market.durationMinutes, market.assetSymbol)}
        </h1>
        {market.questionText && market.questionText !== market.title && (
          <p className="mt-1.5 text-base text-slate-500">
            {resolveMarketTitle(locale, market.questionText, market.questionTextZh, market.durationMinutes, market.assetSymbol)}
          </p>
        )}
      </div>

      {/* Probability bar */}
      <Card className="p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {tm.current_probability}
        </p>
        {isShortDuration ? (
          <LiveProbabilityBar
            assetSymbol={market.assetSymbol}
            spotPriceAtOpen={isUpcoming ? null : market.spotPriceAtOpen}
            closeAt={market.closeAt}
            upLabel={positiveLabel}
            downLabel={negativeLabel}
            fallbackYesPrice={isUpcoming ? "0.5" : market.latestYesPrice}
          />
        ) : (
          <ProbabilityBar
            yesPrice={market.latestYesPrice}
            probYes={tm.prob_yes}
            probNo={tm.prob_no}
          />
        )}
      </Card>

      {isShortDuration && isActive ? (
        <LiveCryptoChart
          marketId={market.id}
          marketSlug={market.slug}
          assetSymbol={market.assetSymbol}
          closeAt={market.closeAt}
          durationMinutes={market.durationMinutes}
          spotPriceAtOpen={isUpcoming ? null : market.spotPriceAtOpen}
          settleLabels={{
            countdownClosesIn: tm.countdown_closes_in,
            countdownExpired: tm.countdown_expired,
            shortDurationBadge: tm.short_duration_badge,
          }}
          labels={{
            title: locale === "zh" ? `${market.durationMinutes}分钟实时价格` : `${market.durationMinutes}-Minute Live Price`,
            subtitle: locale === "zh" ? "Binance实时K线" : `Live Binance candles · ${market.durationMinutes}-min round`,
            currentPrice: locale === "zh" ? "当前价格" : "Current price",
            openingPrice: locale === "zh" ? "开盘价格" : "Opening price",
            priceDifference: locale === "zh" ? "价格变化" : "Price difference",
            roundResult: locale === "zh" ? "本轮结果" : "Round result",
            countdown: locale === "zh" ? "倒计时" : "Countdown",
            priceToBeat: tm.target_price_label,
            reconnect: locale === "zh" ? "重新连接" : "Reconnect",
            loading: locale === "zh" ? "加载中" : "Loading",
            disconnected: locale === "zh" ? "已断开" : "Disconnected",
            reconnecting: locale === "zh" ? "重连中" : "Reconnecting",
            connected: locale === "zh" ? "已连接" : "Connected",
            waiting: locale === "zh" ? "等待Binance实时K线..." : "Waiting for live Binance candles.",
            up: locale === "zh" ? "上涨" : "UP",
            down: locale === "zh" ? "下跌" : "DOWN",
            flat: locale === "zh" ? "持平" : "FLAT",
          }}
        />
      ) : null}

      {/* Price + Date cards — for short-duration markets only show the close time */}
      <div className={`grid gap-4 ${isShortDuration ? "sm:grid-cols-1 max-w-xs" : "sm:grid-cols-3"}`}>
        {!isShortDuration && (
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{positiveLabel}</p>
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
        )}
        {!isShortDuration && (
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{negativeLabel}</p>
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
        )}
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

      {/* Round selector bar — navigate between past/current/upcoming rounds */}
      {isShortDuration && roundHistory && (
        <RoundSelectorBar
          past={roundHistory.past}
          current={roundHistory.current}
          upcoming={roundHistory.upcoming}
          calculatedSlots={calculatedSlots}
          currentSlug={params.slug}
        />
      )}

      {/* Trade form + live position */}
      <TradeArea
        marketId={market.id}
        yesPrice={isUpcoming ? "0.5" : market.latestYesPrice}
        noPrice={isUpcoming ? "0.5" : market.latestNoPrice}
        marketStatus={market.status}
        isShortDuration={isShortDuration}
        assetSymbol={market.assetSymbol}
        closeAt={market.closeAt}
        cutoffAt={market.cutoffAt}
        spotPriceAtOpen={isUpcoming ? null : market.spotPriceAtOpen}
        durationMinutes={market.durationMinutes ?? undefined}
        isUpcoming={isUpcoming}
        locale={locale}
        t={t.trade}
      />

      {/* Order book — only renders when ≥3 open limit orders exist */}
      {isActive && (
        <OrderBookPanel
          marketId={market.id}
          currentPrice={market.latestYesPrice != null ? parseFloat(market.latestYesPrice) : null}
          isShortDuration={isShortDuration}
          locale={locale}
        />
      )}

      {/* Price history chart */}
      <PriceHistoryChart history={priceHistory} locale={locale} t={tm} />

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
