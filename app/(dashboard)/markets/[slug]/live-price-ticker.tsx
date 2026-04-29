"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ASSET_TO_BINANCE } from "@/lib/config/binance-symbols";
import { useBinancePrice } from "@/lib/hooks/use-binance-price";
import { MarketCountdown } from "./market-countdown";

type Props = {
  marketId: string;
  marketSlug: string;
  assetSymbol: string;
  closeAt: string;
  isShortDuration: boolean;
  spotPriceAtOpen: string | null;
  t: {
    live_price: string;
    countdown_closes_in: string;
    countdown_expired: string;
    short_duration_badge: string;
    target_price_label: string;
  };
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function LivePriceTicker({
  marketId,
  marketSlug,
  assetSymbol,
  closeAt,
  isShortDuration,
  spotPriceAtOpen,
  t,
}: Props) {
  const router = useRouter();
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const [settling, setSettling] = useState(false);
  const binanceSymbol = isShortDuration ? (ASSET_TO_BINANCE[assetSymbol] ?? null) : null;
  const { price, prevPrice } = useBinancePrice(binanceSymbol);

  useEffect(() => {
    if (price == null || prevPrice == null || price === prevPrice) return;

    setDirection(price > prevPrice ? "up" : "down");
    const timeoutId = setTimeout(() => setDirection(null), 800);
    return () => clearTimeout(timeoutId);
  }, [price, prevPrice]);

  const handleExpired = useCallback(() => {
    if (settling) return;

    setSettling(true);

    void fetch(`/api/markets/${marketId}/auto-settle`, {
      method: "POST",
    })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as
          | { success?: boolean; nextMarketSlug?: string }
          | null;

        if (!response.ok || !json?.success) return;

        if (json.nextMarketSlug && json.nextMarketSlug !== marketSlug) {
          router.replace(`/markets/${json.nextMarketSlug}`);
          return;
        }

        router.refresh();
      })
      .catch(() => undefined)
      .finally(() => {
        setSettling(false);
      });
  }, [marketId, marketSlug, router, settling]);

  const priceClassName = useMemo(() => {
    if (direction === "up") return "text-green-500";
    if (direction === "down") return "text-red-500";
    return "text-slate-800";
  }, [direction]);

  if (!isShortDuration) return null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge>{t.short_duration_badge}</Badge>
          <MarketCountdown
            closeAt={closeAt}
            t={{
              countdown_closes_in: t.countdown_closes_in,
              countdown_expired: settling ? `${t.countdown_expired}...` : t.countdown_expired,
            }}
            onExpired={handleExpired}
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.live_price}</p>
          <p className={`text-3xl font-bold tabular-nums transition-colors ${priceClassName}`}>
            {price != null ? `$${priceFormatter.format(price)}` : "-"}
          </p>
        </div>

        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-500">{t.target_price_label}</span>{" "}
          <span className="font-semibold tabular-nums text-slate-900">
            {spotPriceAtOpen != null ? `$${priceFormatter.format(Number(spotPriceAtOpen))}` : "-"}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
