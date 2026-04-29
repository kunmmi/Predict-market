"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import type { Locale, T } from "@/lib/i18n/translations";

type TradeSide = "yes" | "no";

type Props = {
  positionId: string;
  marketStatus: string;
  yesUnits: string;
  noUnits: string;
  latestYesPrice: string | null;
  latestNoPrice: string | null;
  locale: Locale;
  t: T["portfolio"];
};

export function SellPositionControl({
  positionId,
  marketStatus,
  yesUnits,
  noUnits,
  latestYesPrice,
  latestNoPrice,
  locale,
  t,
}: Props) {
  const router = useRouter();
  const [activeSide, setActiveSide] = useState<TradeSide | null>(null);
  const [units, setUnits] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yesUnitsNum = Number.parseFloat(yesUnits);
  const noUnitsNum = Number.parseFloat(noUnits);
  const activeUnits = activeSide === "yes" ? yesUnitsNum : noUnitsNum;
  const activePrice =
    activeSide === "yes"
      ? latestYesPrice != null
        ? Number.parseFloat(latestYesPrice)
        : null
      : activeSide === "no"
        ? latestNoPrice != null
          ? Number.parseFloat(latestNoPrice)
          : null
        : null;
  const unitsNum = Number.parseFloat(units);
  const estimatedPayout = useMemo(() => {
    if (!activeSide || activePrice == null || Number.isNaN(unitsNum) || unitsNum <= 0) return null;
    return unitsNum * activePrice;
  }, [activePrice, activeSide, unitsNum]);

  if (marketStatus !== "active" || (yesUnitsNum <= 0 && noUnitsNum <= 0)) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  const openForm = (side: TradeSide) => {
    const maxUnits = side === "yes" ? yesUnitsNum : noUnitsNum;
    setActiveSide(side);
    setUnits(maxUnits > 0 ? String(maxUnits) : "");
    setError(null);
  };

  const closeForm = () => {
    setActiveSide(null);
    setUnits("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeSide) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/trades/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position_id: positionId,
          side: activeSide,
          units,
        }),
      });

      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(json.message ?? "Sell failed.");
        return;
      }

      router.refresh();
      closeForm();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-w-[220px] space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        {yesUnitsNum > 0 ? (
          <Button size="sm" variant="secondary" onClick={() => openForm("yes")}>
            {t.sell_side_yes}
          </Button>
        ) : null}
        {noUnitsNum > 0 ? (
          <Button size="sm" variant="secondary" onClick={() => openForm("no")}>
            {t.sell_side_no}
          </Button>
        ) : null}
      </div>

      {activeSide ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              {activeSide === "yes" ? t.sell_side_yes : t.sell_side_no}
            </span>
            <button
              type="button"
              onClick={closeForm}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-slate-600">{t.sell_units}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                value={units}
                onChange={(event) => setUnits(event.target.value)}
              />
              <button
                type="button"
                className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                onClick={() => setUnits(String(activeUnits))}
              >
                {t.sell_max}
              </button>
            </div>
          </label>

          <div className="text-xs text-slate-500">
            {t.est_payout}:{" "}
            <span className="font-semibold text-slate-800">
              {estimatedPayout != null ? `$${formatDecimal(estimatedPayout, 4)}` : "—"}
            </span>
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <Button
            type="submit"
            size="sm"
            disabled={
              submitting ||
              activePrice == null ||
              Number.isNaN(unitsNum) ||
              unitsNum <= 0 ||
              unitsNum > activeUnits
            }
            className="w-full"
          >
            {submitting
              ? t.selling
              : locale === "zh"
                ? t.sell_confirm
                : `${t.sell_confirm} ${activeSide === "yes" ? "YES" : "NO"}`}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
