"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
      const body = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        asset_symbol: form.asset_symbol,
        question_text: form.question_text.trim() || form.title.trim(),
        rules_text: form.rules_text.trim() || null,
        close_at: form.close_at ? new Date(form.close_at).toISOString() : "",
        settle_at: form.settle_at ? new Date(form.settle_at).toISOString() : "",
        status: form.status,
        title_zh: form.title_zh.trim() || null,
        description_zh: form.description_zh.trim() || null,
        question_text_zh: form.question_text_zh.trim() || null,
        rules_text_zh: form.rules_text_zh.trim() || null,
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
      <div>
        <h1 className="page-title">Create Market</h1>
        <p className="page-subtitle">
          Fill in the details to create a new prediction market.
        </p>
      </div>

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
                  placeholder="Will BTC close above $100,000 by Dec 31?"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Slug *</label>
                <Input
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  placeholder="btc-above-100k-dec-31"
                  required
                />
                <p className="text-xs text-slate-500">Lowercase, hyphens only. Auto-generated from title.</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Asset Symbol *</label>
                <select
                  name="asset_symbol"
                  value={form.asset_symbol}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                  required
                >
                  {ASSET_SYMBOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Category</label>
                <Input
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="Price prediction"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Question Text</label>
                <Input
                  name="question_text"
                  value={form.question_text}
                  onChange={handleChange}
                  placeholder="Leave blank to use title as question"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Market description…"
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
                  placeholder="Resolution rules…"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              {/* Chinese translations */}
              <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Chinese translations (中文翻译)</p>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Title 标题 *</label>
                <Input
                  name="title_zh"
                  value={form.title_zh}
                  onChange={handleChange}
                  placeholder="例如：BTC 是否会在 12 月 31 日前突破 10 万美元？"
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
                <label className="text-sm font-medium text-slate-700">Closes At *</label>
                <Input
                  name="close_at"
                  type="datetime-local"
                  value={form.close_at}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Settles At *</label>
                <Input
                  name="settle_at"
                  type="datetime-local"
                  value={form.settle_at}
                  onChange={handleChange}
                  required
                />
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
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create Market"}
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
    </div>
  );
}
