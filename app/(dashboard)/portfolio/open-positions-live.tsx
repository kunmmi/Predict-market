"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart2, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import type { T } from "@/lib/i18n/translations";
import type { PortfolioPosition } from "@/lib/services/portfolio-data";
import { SellPositionControl } from "./sell-position-control";

type Props = {
  initialPositions: PortfolioPosition[];
  locale: string;
  t: T["portfolio"];
};

type PositionsResponse = {
  success: boolean;
  positions?: PortfolioPosition[];
};

function isExpiredShortDuration(position: PortfolioPosition): boolean {
  return (
    position.durationMinutes != null &&
    new Date(position.marketCloseAt).getTime() < Date.now() &&
    position.marketStatus === "active"
  );
}

export function OpenPositionsLive({ initialPositions, locale, t }: Props) {
  const [positions, setPositions] = useState(initialPositions);
  const [pollingActive, setPollingActive] = useState(true);
  const settlingMarketsRef = useRef<Set<string>>(new Set());

  const fetchPositions = useCallback(async (): Promise<PortfolioPosition[] | null> => {
    try {
      const response = await fetch("/api/portfolio/positions", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return null;
      const json = (await response.json()) as PositionsResponse;
      const nextPositions = json.positions ?? [];
      setPositions(nextPositions);
      return nextPositions;
    } catch {
      return null;
    }
  }, []);

  const settleExpiredMarkets = useCallback(
    async (currentPositions: PortfolioPosition[]) => {
      const marketIds = Array.from(
        new Set(
          currentPositions
            .filter(isExpiredShortDuration)
            .map((position) => position.marketId)
            .filter((marketId) => !settlingMarketsRef.current.has(marketId)),
        ),
      );

      if (marketIds.length === 0) return;

      marketIds.forEach((marketId) => settlingMarketsRef.current.add(marketId));

      await Promise.all(
        marketIds.map(async (marketId) => {
          try {
            await fetch(`/api/markets/${marketId}/auto-settle`, { method: "POST" });
          } catch {
            // Ignore client-triggered settlement errors; polling will retry.
          }
        }),
      );

      const refreshed = await fetchPositions();
      if (!refreshed) return;

      const stillExpired = new Set(
        refreshed.filter(isExpiredShortDuration).map((position) => position.marketId),
      );
      marketIds.forEach((marketId) => {
        if (!stillExpired.has(marketId)) settlingMarketsRef.current.delete(marketId);
      });
    },
    [fetchPositions],
  );

  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  useEffect(() => {
    setPollingActive(true);

    const poll = async () => {
      const nextPositions = await fetchPositions();
      if (nextPositions) {
        await settleExpiredMarkets(nextPositions);
      }
    };

    void poll();
    const intervalId = setInterval(() => {
      void poll();
    }, 15_000);

    return () => {
      setPollingActive(false);
      clearInterval(intervalId);
    };
  }, [fetchPositions, settleExpiredMarkets]);

  const rows = useMemo(
    () =>
      positions.map((position) => {
        const yesUnits = Number(position.yesUnits);
        const noUnits = Number(position.noUnits);
        const avgYesPrice = position.avgYesPrice != null ? Number(position.avgYesPrice) : null;
        const avgNoPrice = position.avgNoPrice != null ? Number(position.avgNoPrice) : null;
        const latestYesPrice = position.latestYesPrice != null ? Number(position.latestYesPrice) : 0;
        const latestNoPrice = position.latestNoPrice != null ? Number(position.latestNoPrice) : 0;
        const costBasis = yesUnits * (avgYesPrice ?? 0) + noUnits * (avgNoPrice ?? 0);
        const currentValue = yesUnits * latestYesPrice + noUnits * latestNoPrice;

        return {
          position,
          totalValue: currentValue,
          unrealizedPnl: currentValue - costBasis,
          pnlLocked: avgYesPrice == null && avgNoPrice == null,
          settling: isExpiredShortDuration(position),
        };
      }),
    [positions],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span>{t.open_positions}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {positions.length}
          </span>
          {pollingActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Live
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <BarChart2 className="mb-3 h-8 w-8 text-slate-200" />
            <p className="text-sm font-medium text-slate-600">{t.no_positions}</p>
            <Link
              href="/markets"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-900 underline underline-offset-4 hover:text-yellow-600"
            >
              {t.browse_markets} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-3 text-left">{t.col_market}</th>
                  <th className="pb-3 pr-3 text-right">{t.col_yes_units}</th>
                  <th className="pb-3 pr-3 text-right">{t.col_no_units}</th>
                  <th className="hidden pb-3 pr-3 text-right sm:table-cell">{t.col_current_yes}</th>
                  <th className="pb-3 pr-3 text-right">{t.col_est_value}</th>
                  <th className="pb-3 pr-3 text-right">{t.col_unrealized_pnl}</th>
                  <th className="pb-3 pl-3 text-right">{t.sell}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ position, totalValue, unrealizedPnl, pnlLocked, settling }) => (
                  <tr
                    key={position.id}
                    className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/60"
                  >
                    <td className="py-3 pr-3">
                      <Link
                        href={`/markets/${position.marketSlug}`}
                        className="font-medium text-slate-800 hover:text-yellow-600 hover:underline"
                      >
                        {locale === "zh" && position.marketTitleZh ? position.marketTitleZh : position.marketTitle}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-green-700">
                      {formatDecimal(position.yesUnits, 4)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-red-600">
                      {formatDecimal(position.noUnits, 4)}
                    </td>
                    <td className="hidden py-3 pr-3 text-right font-mono tabular-nums text-green-700 sm:table-cell">
                      {position.latestYesPrice != null ? `$${formatDecimal(position.latestYesPrice, 4)}` : "—"}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums text-slate-800">
                      ${formatDecimal(totalValue, 4)}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      {settling ? (
                        <span className="text-xs font-medium text-amber-600">{t.expired_short_duration}</span>
                      ) : pnlLocked ? (
                        <span className="text-xs font-medium text-slate-500">{t.pnl_locked}</span>
                      ) : (
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            unrealizedPnl > 0
                              ? "text-green-600"
                              : unrealizedPnl < 0
                                ? "text-red-600"
                                : "text-slate-500"
                          }`}
                        >
                          {unrealizedPnl > 0 ? "+" : ""}
                          ${formatDecimal(unrealizedPnl, 2)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3 align-top text-right">
                      <SellPositionControl
                        positionId={position.id}
                        marketStatus={position.marketStatus}
                        yesUnits={position.yesUnits}
                        noUnits={position.noUnits}
                        latestYesPrice={position.latestYesPrice}
                        latestNoPrice={position.latestNoPrice}
                        locale={locale as "en" | "zh"}
                        t={t}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
