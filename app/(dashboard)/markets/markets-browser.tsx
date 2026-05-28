"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TrendingUp, Clock, ChevronRight, Search, X } from "lucide-react";

import { formatDecimal } from "@/lib/helpers/format-decimal";
import { sideLabel, statusLabel } from "@/lib/i18n/labels";
import { resolveMarketTitle } from "@/lib/short-duration-predictions";
import { cryptoIconUrl, hasCryptoIcon } from "@/lib/helpers/crypto-icon";
import { Card } from "@/components/ui/card";
import type { MarketListItem } from "@/lib/services/market-data";
import type { Locale } from "@/lib/i18n/translations";

type Tab = "all" | "5" | "15" | "30" | "standard";

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
        <span>{yes.toFixed(0)}% {positiveLabel}</span>
        <span>{no.toFixed(0)}% {negativeLabel}</span>
      </div>
    </div>
  );
}

function ShortDurationCard({
  market,
  locale,
  t,
}: {
  market: MarketListItem;
  locale: Locale;
  t: { short_duration_badge: string; live_contract: string; trade_now: string };
}) {
  return (
    <Link href={`/markets/${market.slug}`} className="group block">
      <Card className="relative h-full overflow-hidden border-slate-900/90 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.26),transparent_24%),linear-gradient(160deg,#0f172a_0%,#111827_44%,#1f2937_100%)] shadow-[0_20px_50px_-24px_rgba(15,23,42,0.85)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-700 hover:shadow-[0_28px_64px_-28px_rgba(15,23,42,0.92)]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_32%,rgba(255,255,255,0.02)_100%)]" />
        <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-100 backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute h-5 w-5 animate-ping rounded-full bg-emerald-400/25" />
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

          <div className="mt-4 flex items-center gap-3">
            {hasCryptoIcon(market.assetSymbol) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cryptoIconUrl(market.assetSymbol)}
                alt={market.assetSymbol}
                width={48}
                height={48}
                className="rounded-full shadow-lg ring-2 ring-white/20"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                {market.assetSymbol.slice(0, 2)}
              </span>
            )}
            <div>
              <p className="text-xl font-extrabold text-white">{market.assetSymbol}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {t.short_duration_badge}
                </span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                  {t.live_contract}
                </span>
              </div>
            </div>
          </div>

          <h3 className="mt-4 line-clamp-2 text-lg font-semibold leading-snug text-white">
            {resolveMarketTitle(locale, market.title, market.titleZh, market.durationMinutes, market.assetSymbol)}
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            {locale === "zh" ? "进入市场查看实时价格和交易" : "Enter to see live prices and trade"}
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3 text-sm">
            <span className="text-slate-300">{t.trade_now}</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-200">
              {locale === "zh" ? "查看详情" : "View live market"}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function StandardCard({
  market,
  locale,
  t,
  dateLocale,
}: {
  market: MarketListItem;
  locale: Locale;
  t: { trade_now: string; closes: string };
  dateLocale: string;
}) {
  const positiveLabel = sideLabel("yes", locale);
  const negativeLabel = sideLabel("no", locale);
  return (
    <Link href={`/markets/${market.slug}`} className="group block">
      <Card className="h-full p-5 transition-colors hover:border-slate-300">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {hasCryptoIcon(market.assetSymbol) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cryptoIconUrl(market.assetSymbol)}
                alt={market.assetSymbol}
                width={36}
                height={36}
                className="rounded-full shadow-sm"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                {market.assetSymbol.slice(0, 2)}
              </span>
            )}
            <span className="text-sm font-bold text-slate-800">{market.assetSymbol}</span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              market.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {statusLabel(market.status, locale)}
          </span>
        </div>

        <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
          {resolveMarketTitle(locale, market.title, market.titleZh, market.durationMinutes, market.assetSymbol)}
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

        <ProbabilityBar yesPrice={market.yesPrice} positiveLabel={positiveLabel} negativeLabel={negativeLabel} />

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
    </Link>
  );
}

// Derive available duration tabs from the market list
function getDurationTabs(markets: MarketListItem[]): Tab[] {
  const durations = new Set(
    markets
      .filter((m) => m.durationMinutes != null)
      .map((m) => String(m.durationMinutes) as Tab),
  );
  const hasStandard = markets.some((m) => m.durationMinutes == null);
  const order: Tab[] = ["5", "15", "30"];
  const tabs: Tab[] = ["all", ...order.filter((d) => durations.has(d))];
  if (hasStandard) tabs.push("standard");
  return tabs;
}

export function MarketsBrowser({
  markets,
  locale,
  t,
}: {
  markets: MarketListItem[];
  locale: Locale;
  t: {
    no_markets: string;
    no_markets_sub: string;
    short_duration_badge: string;
    live_contract: string;
    trade_now: string;
    closes: string;
  };
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";
  const tabs = useMemo(() => getDurationTabs(markets), [markets]);

  const tabLabel = (t: Tab) => {
    if (t === "all") return locale === "zh" ? "全部" : "All";
    if (t === "standard") return locale === "zh" ? "标准" : "Standard";
    return `${t} min`;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markets.filter((m) => {
      const matchesTab =
        tab === "all" ||
        (tab === "standard" && m.durationMinutes == null) ||
        String(m.durationMinutes) === tab;
      const matchesSearch =
        !q ||
        m.assetSymbol.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.titleZh ?? "").toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [markets, tab, query]);

  if (markets.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center border-dashed py-20 text-center">
        <TrendingUp className="mb-4 h-12 w-12 text-slate-300" />
        <p className="text-base font-semibold text-slate-700">{t.no_markets}</p>
        <p className="mt-1 text-sm text-slate-400">{t.no_markets_sub}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + tabs row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Duration tabs */}
        {tabs.length > 1 && (
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  tab === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tabLabel(t)}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative w-full sm:w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "zh" ? "搜索市场…" : "Search markets…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-8 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {(query || tab !== "all") && (
        <p className="text-xs text-slate-400">
          {filtered.length} {locale === "zh" ? "个市场" : filtered.length === 1 ? "market" : "markets"}
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">
            {locale === "zh" ? "没有找到匹配的市场" : "No markets match your search"}
          </p>
          <button
            onClick={() => { setQuery(""); setTab("all"); }}
            className="mt-2 text-xs font-semibold text-yellow-600 hover:text-yellow-700"
          >
            {locale === "zh" ? "清除筛选" : "Clear filters"}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((market) =>
            market.durationMinutes != null ? (
              <ShortDurationCard
                key={market.id}
                market={market}
                locale={locale}
                t={t}
              />
            ) : (
              <StandardCard
                key={market.id}
                market={market}
                locale={locale}
                t={t}
                dateLocale={dateLocale}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
