"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const ASSET_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "USDT", "USDC", "XRP", "ADA", "DOGE"] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 200);
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

export default function AdminMarketNewPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    category: "",
    asset_symbol: "BTC",
    question_text: "",
    rules_text: "",
    close_at: "",
    settle_at: "",
    status: "draft",
    title_zh: "",
    description_zh: "",
    question_text_zh: "",
    rules_text_zh: "",
  });
  const [slugManual, setSlugManual] = useState(false);
  const [isShortDuration, setIsShortDuration] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<3 | 5 | 10 | 15 | 30 | 60>(5);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    if (name === "title" && !slugManual) {
      setForm((f) => ({ ...f, title: value, slug: slugify(value) }));
    } else if (name === "slug") {
      setSlugManual(true);
      setForm((f) => ({ ...f, slug: value }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const sharedBody = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        asset_symbol: form.asset_symbol,
        question_text: form.question_text.trim() || form.title.trim(),
        rules_text: form.rules_text.trim() || null,
        status: form.status,
        title_zh: form.title_zh.trim() || null,
        description_zh: form.description_zh.trim() || null,
        question_text_zh: form.question_text_zh.trim() || null,
        rules_text_zh: form.rules_text_zh.trim() || null,
      };

      const body = isShortDuration
        ? { ...sharedBody, duration_minutes: durationMinutes }
        : {
            ...sharedBody,
            close_at: form.close_at ? new Date(form.close_at).toISOString() : "",
            settle_at: form.settle_at ? new Date(form.settle_at).toISOString() : "",
          };

      const res = await fetch("/api/admin/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.message ?? "Failed to create market.");
        setLoading(false);
        return;
      }

      router.push("/admin/markets");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

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
          <h1 className="text-2xl font-bold tracking-tight text-white">Create Market</h1>
          <p className="mt-0.5 text-sm text-slate-500">Fill in the details to create a new prediction market.</p>
        </div>
      </div>

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
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                className={inputClass}
                placeholder="Will SOL be up or down in the next 5 minutes?"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Slug *</label>
              <input
                name="slug"
                value={form.slug}
                onChange={handleChange}
                className={inputClass}
                placeholder="will-sol-be-up-or-down-in-5-mins"
                required
              />
              <p className="mt-1 text-xs text-slate-600">Lowercase, hyphens only. Auto-generated from title.</p>
            </div>

            <div>
              <label className={labelClass}>Asset Symbol *</label>
              <select name="asset_symbol" value={form.asset_symbol} onChange={handleChange} className={selectClass} required>
                {ASSET_SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Category</label>
              <input name="category" value={form.category} onChange={handleChange} className={inputClass} placeholder="Price prediction" />
            </div>

            {/* Short-Duration toggle */}
            <div className="sm:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-200">Short-Duration Contract</p>
                  <p className="mt-1 text-xs text-slate-500">
                    3–30 min up/down contract. Close time is auto-computed from activation.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isShortDuration}
                    onChange={(e) => setIsShortDuration(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-amber-400"
                  />
                  <span className="text-xs font-semibold text-slate-400">Enable</span>
                </label>
              </div>

              {isShortDuration && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Duration</p>
                  <div className="flex flex-wrap gap-2">
                    {([3, 5, 10, 15, 30, 60] as const).map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                          durationMinutes === mins
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                            : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.14] hover:text-white"
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                  <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-500">
                    One live market offers both Up and Down. Opening price is captured at activation; round resolves Up if finish price ≥ opening price.
                  </p>
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Question Text</label>
              <input name="question_text" value={form.question_text} onChange={handleChange} className={inputClass} placeholder="Leave blank to use title as question" />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={textareaClass} placeholder="Market description…" />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Rules</label>
              <textarea name="rules_text" value={form.rules_text} onChange={handleChange} rows={4} className={textareaClass} placeholder="Resolution rules…" />
            </div>

            {!isShortDuration && (
              <>
                <div>
                  <label className={labelClass}>Closes At *</label>
                  <input name="close_at" type="datetime-local" value={form.close_at} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Settles At *</label>
                  <input name="settle_at" type="datetime-local" value={form.settle_at} onChange={handleChange} className={inputClass} required />
                </div>
              </>
            )}

            <div>
              <label className={labelClass}>Status</label>
              <select name="status" value={form.status} onChange={handleChange} className={selectClass}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Chinese Translations (中文翻译)">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title 标题</label>
              <input name="title_zh" value={form.title_zh} onChange={handleChange} className={inputClass} placeholder="例如：SOL 在未来 5 分钟会上涨还是下跌？" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description 描述</label>
              <textarea name="description_zh" value={form.description_zh} onChange={handleChange} rows={3} className={textareaClass} placeholder="市场描述…" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Question Text 问题</label>
              <input name="question_text_zh" value={form.question_text_zh} onChange={handleChange} className={inputClass} placeholder="中文问题…" />
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
            {loading ? "Creating…" : "Create Market"}
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
    </div>
  );
}
