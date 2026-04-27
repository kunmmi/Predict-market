"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

import type { PricePoint } from "@/lib/services/market-data";

type Props = {
  data: PricePoint[];
  emptyMessage: string;
  yesLabel: string;
  noLabel: string;
};

type ChartRow = {
  time: string;
  [key: string]: string | number;
};

export function PriceChart({ data, emptyMessage, yesLabel, noLabel }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex h-36 items-center justify-center text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  const chartData: ChartRow[] = data.map((p) => ({
    time: p.time,
    [yesLabel]: parseFloat((p.yesPrice * 100).toFixed(1)),
    [noLabel]: parseFloat((p.noPrice * 100).toFixed(1)),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={chartData}
        margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={(val: string) => {
            try {
              return format(new Date(val), "MMM d HH:mm");
            } catch {
              return "";
            }
          }}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={60}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(val: number) => `${val}%`}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          width={42}
        />
        <Tooltip
          formatter={(value: any, name: any) => [
            `${Number(value).toFixed(1)}%`,
            name,
          ]}
          labelFormatter={(label: any) => {
            try {
              return format(new Date(String(label)), "MMM d, yyyy  HH:mm");
            } catch {
              return String(label);
            }
          }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
          iconType="circle"
          iconSize={8}
        />
        <Line
          type="monotone"
          dataKey={yesLabel}
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "#22c55e" }}
        />
        <Line
          type="monotone"
          dataKey={noLabel}
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "#ef4444" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}