"use client";

import { useRef, useState } from "react";
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
  durationMinutes?: number;
  isUpcoming?: boolean;
  locale: Locale;
  t: T["trade"];
};

export function TradeArea(props: Props) {
  const [tick, setTick] = useState(0);
  const tradeFormRef = useRef<HTMLDivElement>(null);

  const handleBuyAgain = () => {
    tradeFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-4">
      <div ref={tradeFormRef}>
        <TradeForm
          {...props}
          onTradeSuccess={() => setTick((n) => n + 1)}
        />
      </div>
      <MarketPositionPanel
        marketId={props.marketId}
        isShortDuration={props.isShortDuration}
        assetSymbol={props.assetSymbol}
        closeAt={props.closeAt}
        spotPriceAtOpen={props.spotPriceAtOpen}
        locale={props.locale}
        refreshTick={tick}
        onBuyAgain={handleBuyAgain}
      />
    </div>
  );
}
