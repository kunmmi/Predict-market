"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { MarketDetail } from "@/lib/services/market-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ASSET_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "USDT", "USDC", "XRP", "ADA", "DOGE"] as const;

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  // datetime-local expects "YYYY-MM-DDTHH:MM"
  return iso.slice(0, 16);
}

type Props = { market: MarketDetail };



export function AdminMarketEditForm({ market }: Props) {
  const router = useRouter();

  const [form, setForm] = useState({
    title: market.title,
    slug: market.slug,
    description: market.description ?? "",
    category: market.category ?? "",
    asset_symbol: market.assetSymbol,
    question_text: market.questionText,
    rules_text: market.rulesText ?? "",
    close_at: toDatetimeLocal(market.closeAt),
    settle_at: toDatetimeLocal(market.settleAt),
    status: market.status,
    title_zh: market.titleZh ?? "",
    description_zh: market.descriptionZh ?? "",
    question_text_zh: market.questionTextZh ?? "",
    rules_text_zh: market.rulesTextZh ?? "",
  });

  // Settlement form state
  const [settlement, setSettlement] = useState({
    resolution: "yes" as "yes" | "no" | "cancelled",
    notes: "",
  });

  // Price update state
  const [priceYes, setPriceYes] = useState(
    market.latestYesPrice != null ? String(market.latestYesPrice) : "0.50",
  );
  const priceNo =
    priceYes !== "" && !isNaN(parseFloat(priceYes))
      ? (1 - parseFloat(priceYes)).toFixed(4)
      : "—";
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceSuccess, setPriceSuccess] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleSuccess, setSettleSuccess] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        asset_symbol: form.asset_symbol,
        question_text: form.question_text.trim() || form.title.trim(),
        rules_text: form.rules_text.trim() || null,
        close_at: form.close_at ? new Date(form.close_at).toISOString() : market.closeAt,
        settle_at: form.settle_at ? new Date(form.settle_at).toISOString() : market.settleAt,
        status: form.status,
        title_zh: form.title_zh.trim() || null,
        description_zh: form.description_zh.trim() || null,
        question_text_zh: form.question_text_zh.trim() || null,
        rules_text_zh: form.rules_text_zh.trim() || null,
      };

      const res = await fetch(`/api/admin/markets/${market.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.message ?? "Failed to update market.");
        setLoading(false);
        return;
      }

      router.push("/admin/markets");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  async function handlePriceUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPriceError(null);
    setPriceSuccess(false);
    setPriceLoading(true);

    const yesNum = parseFloat(priceYes);
    if (isNaN(yesNum) || yesNum < 0.01 || yesNum > 0.99) {
      setPriceError("YES price must be between 0.01 and 0.99.");
      setPriceLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/markets/${market.id}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yes_price: yesNum }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPriceError(json.message ?? "Failed to update price.");
        setPriceLoading(false);
        return;
      }
      setPriceSuccess(true);
    } catch {
      setPriceError("Network error. Please try again.");
    } finally {
      setPriceLoading(false);
    }
  }

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    setSettleError(null);
    setSettleLoading(true);

    try {
      const res = await fetch(`/api/admin/markets/${market.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution: settlement.resolution,
          notes: settlement.notes.trim() || null,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setSettleError(json.message ?? "Settlement failed.");
        setSettleLoading(false);
        return;
      }

      setSettleSuccess(true);
      router.refresh();
    } catch {
      setSettleError("Network error. Please try again.");
      setSettleLoading(false);
    }
  }

  const isSettled = market.status === "settled" || market.status === "cancelled";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Market</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update market details or settle the market.
        </p>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Market Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Title *</label>
                <Input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Slug *</label>
                <Input
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Asset Symbol</label>
                <select
                  name="asset_symbol"
                  value={form.asset_symbol}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  {ASSET_SYMBOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="settled">Settled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Category</label>
                <Input
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Question Text</label>
                <Input
                  name="question_text"
                  value={form.question_text}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Rules</label>
                <textarea
                  name="rules_text"
                  value={form.rules_text}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              {/* Chinese translations */}
              <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Chinese translations (中文翻译)</p>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Title 标题</label>
                <Input
                  name="title_zh"
                  value={form.title_zh}
                  onChange={handleChange}
                  placeholder="中文标题…"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description 描述</label>
                <textarea
                  name="description_zh"
                  value={form.description_zh}
                  onChange={handleChange}
                  rows={3}
                  placeholder="市场描述…"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Rules 规则</label>
                <textarea
                  name="rules_text_zh"
                  value={form.rules_text_zh}
                  onChange={handleChange}
                  rows={4}
                  placeholder="结算规则…"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Closes At</label>
                <Input
                  name="close_at"
                  type="datetime-local"
                  value={form.close_at}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Settles At</label>
                <Input
                  name="settle_at"
                  type="datetime-local"
                  value={form.settle_at}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/markets")}
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Price Update */}
      <Card>
        <CardHeader>
          <CardTitle>Update Prices</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePriceUpdate} className="space-y-4">
            {priceError && (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {priceError}
              </div>
            )}
            {priceSuccess && (
              <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Prices updated successfully.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">YES Price (0.01–0.99)</label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0.01"
                  max="0.99"
                  value={priceYes}
                  onChange={(e) => {
                    setPriceYes(e.target.value);
                    setPriceSuccess(false);
                  }}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">NO Price (computed)</label>
                <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                  {priceNo}
                </div>
              </div>
            </div>
            <Button type="submit" disabled={priceLoading} variant="outline">
              {priceLoading ? "Updating…" : "Update Price"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Settlement Form */}
      <Card>
        <CardHeader>
          <CardTitle>Settle Market</CardTitle>
        </CardHeader>
        <CardContent>
          {isSettled ? (
            <p className="text-sm text-slate-500">
              This market is already {market.status}
              {market.resolutionOutcome !== "unresolved"
                ? ` (outcome: ${market.resolutionOutcome})`
                : ""}
              .
            </p>
          ) : settleSuccess ? (
            <p className="text-sm font-medium text-green-700">Market settled successfully.</p>
          ) : (
            <form onSubmit={handleSettle} className="space-y-4">
              {settleError && (
                <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {settleError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Outcome *</label>
                <div className="flex gap-4">
                  {(["yes", "no", "cancelled"] as const).map((outcome) => (
                    <label key={outcome} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="resolution"
                        value={outcome}
                        checked={settlement.resolution === outcome}
                        onChange={() =>
                          setSettlement((s) => ({ ...s, resolution: outcome }))
                        }
                      />
                      <span className="capitalize">{outcome}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Resolution Notes</label>
                <textarea
                  value={settlement.notes}
                  onChange={(e) =>
                    setSettlement((s) => ({ ...s, notes: e.target.value }))
                  }
                  rows={2}
                  placeholder="Optional notes about the resolution…"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <Button type="submit" disabled={settleLoading} variant="default">
                {settleLoading ? "Settling…" : "Settle Market"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
