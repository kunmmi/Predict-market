export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Clock, CheckCircle } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { getMarketByIdAdmin, getMarketBySlug, getMarketPriceHistory, getMarketOutcomes } from "@/lib/services/market-data";
import { settleShortDurationMarketById, ensureRoundOpeningPrice } from "@/lib/services/short-duration-settlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWalletData } from "@/lib/services/wallet-data";
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
import { LiveOutcomes } from "./live-outcomes";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", height: 6, width: "100%", overflow: "hidden", borderRadius: 3, backgroundColor: "var(--border-subtle)" }}>
        <div style={{ width: `${yes}%`, background: "var(--teal)", transition: "width 500ms ease" }} />
        <div style={{ width: `${no}%`, background: "var(--rose)", transition: "width 500ms ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--teal)" }}>{yes.toFixed(1)}% {probYes}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--rose)" }}>{no.toFixed(1)}% {probNo}</span>
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

  const [priceHistory, outcomes, walletData] = await Promise.all([
    getMarketPriceHistory(market.id),
    market.marketType === "multi" ? getMarketOutcomes(market.id) : Promise.resolve([]),
    getWalletData(profile.id),
  ]);
  const walletBalance = parseFloat(walletData.wallet?.availableBalance ?? "0") || 0;

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
        durationMinutes={market.durationMinutes}
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
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{market.assetSymbol}</p>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  borderRadius: 100,
                  padding: "2px 10px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  backgroundColor: isActive ? "var(--teal-dim)" : isSettled ? "rgba(99,102,241,0.12)" : "var(--bg-elevated)",
                  border: `1px solid ${isActive ? "rgba(13,184,145,0.25)" : isSettled ? "rgba(99,102,241,0.25)" : "var(--border-subtle)"}`,
                  color: isActive ? "var(--teal)" : isSettled ? "#818CF8" : "var(--text-dim)",
                }}
              >
                {statusLabel(market.status, locale)}
              </span>
              {market.resolutionOutcome !== "unresolved" && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 100,
                    padding: "2px 10px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    backgroundColor: market.resolutionOutcome === "yes" ? "var(--teal-dim)" : market.resolutionOutcome === "no" ? "var(--rose-dim)" : "var(--bg-elevated)",
                    border: `1px solid ${market.resolutionOutcome === "yes" ? "rgba(13,184,145,0.25)" : market.resolutionOutcome === "no" ? "rgba(232,68,90,0.25)" : "var(--border-subtle)"}`,
                    color: market.resolutionOutcome === "yes" ? "var(--teal)" : market.resolutionOutcome === "no" ? "var(--rose)" : "var(--text-dim)",
                  }}
                >
                  <CheckCircle style={{ width: 10, height: 10 }} />
                  {tm.resolved_label} {market.resolutionOutcome.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>
        <h1 style={{ marginTop: 14, fontFamily: "var(--font-sans)", fontSize: "clamp(1.25rem, 3vw, 1.75rem)", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)", lineHeight: 1.35 }}>
          {resolveMarketTitle(locale, market.title, market.titleZh, market.durationMinutes, market.assetSymbol)}
        </h1>
        {market.questionText && market.questionText !== market.title && (
          <p style={{ marginTop: 6, fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {resolveMarketTitle(locale, market.questionText, market.questionTextZh, market.durationMinutes, market.assetSymbol)}
          </p>
        )}
      </div>

      {/* Multi-outcome list — replaces probability bar for multi markets */}
      {market.marketType === "multi" ? (
        <Card>
          <div style={{ padding: "16px 20px 20px" }}>
            <LiveOutcomes
              marketId={market.id}
              initialOutcomes={outcomes}
              marketStatus={market.status}
              locale={locale}
              walletBalance={walletBalance}
            />
          </div>
        </Card>
      ) : (
      /* Probability bar — binary markets only */
      <Card>
        <div style={{ padding: "16px 20px 18px" }}>
        <p style={{ marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-dim)" }}>
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
        </div>
      </Card>
      )}

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
        {!isShortDuration && (
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
        )}
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

      {/* Trade form + live position — binary markets only */}
      {market.marketType !== "multi" && (
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
      )}

      {/* Price history chart — hidden for short-duration and multi markets */}
      {!isShortDuration && market.marketType !== "multi" && <PriceHistoryChart history={priceHistory} locale={locale} t={tm} />}

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
