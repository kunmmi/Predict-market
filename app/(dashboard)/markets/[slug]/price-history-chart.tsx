import { formatDecimal } from "@/lib/helpers/format-decimal";
import type { Locale, T } from "@/lib/i18n/translations";
import type { PricePoint } from "@/lib/services/market-data";

type Props = {
  history: PricePoint[];
  locale: Locale;
  t: T["market_detail"];
};

type ChartPoint = {
  x: number;
  yesY: number;
  noY: number;
};

const CHART_WIDTH = 100;
const CHART_HEIGHT = 100;
const CHART_PADDING_X = 6;
const CHART_PADDING_Y = 10;

function pathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function formatChartTime(value: string, locale: Locale): string {
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";
  return new Date(value).toLocaleString(dateLocale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PriceHistoryChart({ history, locale, t }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
        {t.price_history_empty}
      </div>
    );
  }

  const series = history.slice(-72);
  const count = series.length;
  const first = series[0];
  const last = series[count - 1];
  const innerWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;

  const points: ChartPoint[] = series.map((point, index) => {
    const x =
      count === 1
        ? CHART_WIDTH / 2
        : CHART_PADDING_X + (index / (count - 1)) * innerWidth;
    const yesY = CHART_PADDING_Y + (1 - point.yesPrice) * innerHeight;
    const noY = CHART_PADDING_Y + (1 - point.noPrice) * innerHeight;

    return { x, yesY, noY };
  });

  const yesPath = pathFromPoints(points.map((point) => ({ x: point.x, y: point.yesY })));
  const noPath = pathFromPoints(points.map((point) => ({ x: point.x, y: point.noY })));

  const gridValues = [0.25, 0.5, 0.75];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span>{t.chart_yes}</span>
            <span className="font-semibold text-green-600">${formatDecimal(last.yesPrice, 2)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span>{t.chart_no}</span>
            <span className="font-semibold text-red-500">${formatDecimal(last.noPrice, 2)}</span>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>{formatChartTime(first.time, locale)}</div>
          <div>{formatChartTime(last.time, locale)}</div>
        </div>
      </div>

      <div className="relative min-h-[240px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 p-3">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-[220px] w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={t.price_history}
        >
          {gridValues.map((value) => {
            const y = CHART_PADDING_Y + (1 - value) * innerHeight;
            return (
              <line
                key={value}
                x1={CHART_PADDING_X}
                x2={CHART_WIDTH - CHART_PADDING_X}
                y1={y}
                y2={y}
                stroke="#cbd5e1"
                strokeDasharray="2 2"
                strokeWidth="0.5"
              />
            );
          })}

          <path d={yesPath} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
          <path d={noPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />

          {count > 1 ? (
            <>
              <circle cx={points[count - 1]!.x} cy={points[count - 1]!.yesY} r="1.8" fill="#16a34a" />
              <circle cx={points[count - 1]!.x} cy={points[count - 1]!.noY} r="1.8" fill="#ef4444" />
            </>
          ) : (
            <>
              <circle cx={points[0]!.x} cy={points[0]!.yesY} r="1.8" fill="#16a34a" />
              <circle cx={points[0]!.x} cy={points[0]!.noY} r="1.8" fill="#ef4444" />
            </>
          )}
        </svg>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
