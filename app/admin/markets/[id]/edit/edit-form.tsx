"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { MarketDetail, MarketOutcomeItem } from "@/lib/services/market-data";

const ASSET_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "USDT", "USDC", "XRP", "ADA", "DOGE"] as const;

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

const inputClass =
  "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none transition-colors";
const selectClass =
  "w-full rounded-lg border border-white/[0.08] bg-[#111318] px-3 py-2.5 text-sm text-slate-200 focus:border-amber-400/40 focus:outline-none transition-colors";
const labelClass = "block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5";
const textareaClass =
  "w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none transition-colors";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

type Props = { market: MarketDetail; outcomes?: MarketOutcomeItem[] };

export function AdminMarketEditForm({ market, outcomes = [] }: Props) {
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

  const [settlement, setSettlement] = useState({
    resolution: "yes" as "yes" | "no" | "cancelled",
    notes: "",
  });

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

  // Multi-outcome settlement
  const [multiWinnerId, setMultiWinnerId] = useState<string>("");
  const [multiNotes, setMultiNotes] = useState("");
  const [multiSettleLoading, setMultiSettleLoading] = useState(false);
  const [multiSettleError, setMultiSettleError] = useState<string | null>(null);
  const [multiSettleSuccess, setMultiSettleSuccess] = useState(false);

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

  async function handleMultiSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!multiWinnerId) { setMultiSettleError("Select a winning outcome."); return; }
    setMultiSettleError(null);
    setMultiSettleLoading(true);

    try {
      const res = await fetch(`/api/admin/markets/${market.id}/settle-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner_outcome_id: multiWinnerId, notes: multiNotes.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMultiSettleError(json.message ?? "Settlement failed.");
        return;
      }
      setMultiSettleSuccess(true);
      router.refresh();
    } catch {
      setMultiSettleError("Network error. Please try again.");
    } finally {
      setMultiSettleLoading(false);
    }
  }

  const isSettled = market.status === "settled" || market.status === "cancelled";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/markets"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:border-white/[0.14] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Edit Market</h1>
          <p className="mt-0.5 text-sm text-slate-500">Update details, adjust prices, or settle the market.</p>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-400">
            {error}
          </div>
        )}

        <SectionCard title="Market Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title *</label>
              <input name="title" value={form.title} onChange={handleChange} className={inputClass} required />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Slug *</label>
              <input name="slug" value={form.slug} onChange={handleChange} className={inputClass} required />
            </div>

            <div>
              <label className={labelClass}>Asset Symbol</label>
              <select name="asset_symbol" value={form.asset_symbol} onChange={handleChange} className={selectClass}>
                {ASSET_SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <select name="status" value={form.status} onChange={handleChange} className={selectClass}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="settled">Settled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Category</label>
              <input name="category" value={form.category} onChange={handleChange} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Question Text</label>
              <input name="question_text" value={form.question_text} onChange={handleChange} className={inputClass} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={textareaClass} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Rules</label>
              <textarea name="rules_text" value={form.rules_text} onChange={handleChange} rows={4} className={textareaClass} />
            </div>

            <div>
              <label className={labelClass}>Closes At</label>
              <input name="close_at" type="datetime-local" value={form.close_at} onChange={handleChange} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Settles At</label>
              <input name="settle_at" type="datetime-local" value={form.settle_at} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Chinese Translations (中文翻译)">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title 标题</label>
              <input name="title_zh" value={form.title_zh} onChange={handleChange} className={inputClass} placeholder="中文标题…" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description 描述</label>
              <textarea name="description_zh" value={form.description_zh} onChange={handleChange} rows={3} className={textareaClass} placeholder="市场描述…" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Rules 规则</label>
              <textarea name="rules_text_zh" value={form.rules_text_zh} onChange={handleChange} rows={4} className={textareaClass} placeholder="结算规则…" />
            </div>
          </div>
        </SectionCard>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-[0_0_16px_rgba(251,191,36,0.2)] transition-all hover:bg-amber-300 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/markets")}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:border-white/[0.14] hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Price update */}
      <SectionCard title="Update Prices">
        <form onSubmit={handlePriceUpdate} className="space-y-4">
          {priceError && (
            <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-400">
              {priceError}
            </div>
          )}
          {priceSuccess && (
            <div className="rounded-lg border border-teal-400/20 bg-teal-400/10 px-4 py-3 text-sm text-teal-400">
              Prices updated successfully.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>YES Price (0.01 – 0.99)</label>
              <input
                type="number"
                step="0.0001"
                min="0.01"
                max="0.99"
                value={priceYes}
                onChange={(e) => { setPriceYes(e.target.value); setPriceSuccess(false); }}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>NO Price (computed)</label>
              <div className="flex h-[42px] items-center rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 font-mono text-sm text-slate-500">
                {priceNo}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={priceLoading}
            className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
          >
            {priceLoading ? "Updating…" : "Update Price"}
          </button>
        </form>
      </SectionCard>

      {/* Multi-outcome settlement — only shown for multi markets */}
      {market.marketType === "multi" && (
        <SectionCard title="Settle Multi-Outcome Market">
          {isSettled ? (
            <p className="text-sm text-slate-500">
              This market is already <span className="font-semibold text-slate-300">{market.status}</span>.
            </p>
          ) : multiSettleSuccess ? (
            <p className="rounded-lg border border-teal-400/20 bg-teal-400/10 px-4 py-3 text-sm text-teal-400">
              Multi-market settled successfully.
            </p>
          ) : (
            <form onSubmit={handleMultiSettle} className="space-y-4">
              {multiSettleError && (
                <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-400">
                  {multiSettleError}
                </div>
              )}
              <div>
                <label className={labelClass}>Winning Outcome *</label>
                {outcomes.length === 0 ? (
                  <p className="text-sm text-slate-500 mt-1">No outcomes found for this market.</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2 max-h-72 overflow-y-auto">
                    {outcomes.map((o) => (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                          multiWinnerId === o.id
                            ? "border-teal-400/40 bg-teal-400/10 text-teal-400"
                            : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.14] hover:text-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="winner_outcome"
                          value={o.id}
                          checked={multiWinnerId === o.id}
                          onChange={() => setMultiWinnerId(o.id)}
                          className="sr-only"
                        />
                        <span className="flex-1">{o.label}</span>
                        <span className="font-mono text-xs opacity-60">{Math.round(o.price * 100)}%</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Resolution Notes</label>
                <textarea
                  value={multiNotes}
                  onChange={(e) => setMultiNotes(e.target.value)}
                  rows={2}
                  className={textareaClass}
                  placeholder="Optional notes about the resolution…"
                />
              </div>
              <button
                type="submit"
                disabled={multiSettleLoading || !multiWinnerId}
                className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
              >
                {multiSettleLoading ? "Settling…" : "Declare Winner & Settle"}
              </button>
            </form>
          )}
        </SectionCard>
      )}

      {/* Settlement — binary markets only */}
      <SectionCard title="Settle Market">
        {isSettled ? (
          <p className="text-sm text-slate-500">
            This market is already{" "}
            <span className="font-semibold text-slate-300">{market.status}</span>
            {market.resolutionOutcome !== "unresolved" ? ` (outcome: ${market.resolutionOutcome})` : ""}.
          </p>
        ) : settleSuccess ? (
          <p className="rounded-lg border border-teal-400/20 bg-teal-400/10 px-4 py-3 text-sm text-teal-400">
            Market settled successfully.
          </p>
        ) : (
          <form onSubmit={handleSettle} className="space-y-4">
            {settleError && (
              <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-400">
                {settleError}
              </div>
            )}

            <div>
              <label className={labelClass}>Outcome *</label>
              <div className="flex flex-wrap gap-3 mt-2">
                {(["yes", "no", "cancelled"] as const).map((outcome) => (
                  <label
                    key={outcome}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all ${
                      settlement.resolution === outcome
                        ? outcome === "yes"
                          ? "border-teal-400/40 bg-teal-400/10 text-teal-400"
                          : outcome === "no"
                          ? "border-rose-400/40 bg-rose-400/10 text-rose-400"
                          : "border-slate-500 bg-slate-700/50 text-slate-300"
                        : "border-white/[0.08] bg-white/[0.03] text-slate-500 hover:border-white/[0.14] hover:text-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolution"
                      value={outcome}
                      checked={settlement.resolution === outcome}
                      onChange={() => setSettlement((s) => ({ ...s, resolution: outcome }))}
                      className="sr-only"
                    />
                    <span className="capitalize">{outcome}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Resolution Notes</label>
              <textarea
                value={settlement.notes}
                onChange={(e) => setSettlement((s) => ({ ...s, notes: e.target.value }))}
                rows={2}
                className={textareaClass}
                placeholder="Optional notes about the resolution…"
              />
            </div>

            <button
              type="submit"
              disabled={settleLoading}
              className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
            >
              {settleLoading ? "Settling…" : "Settle Market"}
            </button>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
