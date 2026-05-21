"use client";

import { useState } from "react";
import { TradeForm } from "./trade-form";
import { MarketPositionPanel } from "./market-position-panel";
import type { Locale, T } from "@/lib/i18n/translations";

type Props = {
  marketId: string;
  yesPrice: string | null;
  noPrice: string | null;
  marketStatus: string;
  isShortDuration: boolean;
  assetSymbol: string;
  closeAt: string;
  cutoffAt?: string | null;
  spotPriceAtOpen?: string | null;
  locale: Locale;
  t: T["trade"];
};

export function TradeArea(props: Props) {
  const [tick, setTick] = useState(0);

  return (
    <div className="space-y-4">
      <TradeForm
        {...props}
        onTradeSuccess={() => setTick((n) => n + 1)}
      />
      <MarketPositionPanel
        marketId={props.marketId}
        isShortDuration={props.isShortDuration}
        locale={props.locale}
        refreshTick={tick}
      />
    </div>
  );
}
