"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sideLabel } from "@/lib/i18n/labels";
import type { T } from "@/lib/i18n/translations";

type LimitOrder = {
  id: string;
  market_id: string;
  side: "yes" | "no";
  amount_stake: string;
  fee_amount: string;
  target_price: string;
  status: string;
  created_at: string;
  markets: {
    title: string;
    title_zh: string | null;
    slug: string;
    asset_symbol: string;
    duration_minutes: number | null;
    close_at: string;
    status: string;
  };
};

type Props = {
  locale: string;
  t: T["portfolio"];
};

export function LimitOrdersPanel({ locale, t }: Props) {
  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/limit-orders?status=open");
      if (!res.ok) return;
      const json = await res.json();
      setOrders(json.orders ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  async function handleCancel(orderId: string) {
    setCancelling(orderId);
    setCancelSuccess(null);
    try {
      const res = await fetch(`/api/limit-orders/${orderId}`, { method: "DELETE" });
      if (res.ok) {
        setCancelSuccess(orderId);
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    } catch {
      // silent
    } finally {
      setCancelling(null);
    }
  }

  if (loading) return null;
  if (orders.length === 0) return null;

  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>{t.open_limit_orders ?? "Open Limit Orders"}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {orders.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cancelSuccess && (
          <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
            {t.cancel_success ?? "Order cancelled."}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-3 text-left">{t.limit_order_col_market ?? "Market"}</th>
                <th className="pb-3 pr-3 text-left">{t.limit_order_col_side ?? "Side"}</th>
                <th className="pb-3 pr-3 text-right">{t.limit_order_col_amount ?? "Amount"}</th>
                <th className="pb-3 pr-3 text-right">{t.limit_order_col_target ?? "Target Price"}</th>
                <th className="hidden pb-3 pr-3 text-right sm:table-cell">{t.limit_order_col_placed ?? "Placed"}</th>
                <th className="pb-3 text-right">{t.cancel_order ?? "Cancel"}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const marketTitle =
                  locale === "zh" && order.markets.title_zh
                    ? order.markets.title_zh
                    : order.markets.title;
                return (
                  <tr
                    key={order.id}
                    className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/60"
                  >
                    <td className="py-3 pr-3">
                      <a
                        href={`/markets/${order.markets.slug}`}
                        className="font-medium text-slate-800 hover:text-yellow-600 hover:underline"
                      >
                        {marketTitle}
                      </a>
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          order.side === "yes"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {sideLabel(order.side, locale as "en" | "zh")}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-slate-700">
                      ${parseFloat(order.amount_stake).toFixed(2)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-amber-700">
                      {(parseFloat(order.target_price) * 100).toFixed(1)}¢
                    </td>
                    <td className="hidden py-3 pr-3 text-right text-xs text-slate-400 sm:table-cell">
                      {new Date(order.created_at).toLocaleDateString(dateLocale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cancelling === order.id}
                        onClick={() => handleCancel(order.id)}
                        className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        {cancelling === order.id
                          ? (t.cancelling ?? "Cancelling…")
                          : (t.cancel_order ?? "Cancel")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
