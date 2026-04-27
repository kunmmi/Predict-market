"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PricePoint } from "@/lib/services/market-data";
import { PriceChart } from "./price-chart";

type MarketDetailTranslations = {
  price_history: string;
  price_history_empty: string;
  chart_yes: string;
  chart_no: string;
  [key: string]: string;
};

type Props = {
  history: PricePoint[];
  locale: string;
  t: MarketDetailTranslations;
};

export function PriceHistoryChart({ history, t }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t.price_history}</CardTitle>
      </CardHeader>
      <CardContent>
        <PriceChart
          data={history}
          emptyMessage={t.price_history_empty}
          yesLabel={t.chart_yes}
          noLabel={t.chart_no}
        />
      </CardContent>
    </Card>
  );
}