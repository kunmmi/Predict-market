"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import Link from "next/link";
import { TrendingUp, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

import { formatDecimal } from "@/lib/helpers/format-decimal";
import type { AdminMarketRow } from "@/lib/services/market-data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:    "bg-teal-400/10 text-teal-400 border-teal-400/20",
    settled:   "bg-violet-400/10 text-violet-400 border-violet-400/20",
    cancelled: "bg-rose-400/10 text-rose-400 border-rose-400/20",
    draft:     "bg-slate-700 text-slate-400 border-slate-600",
    closed:    "bg-slate-700 text-slate-400 border-slate-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status] ?? "bg-slate-700 text-slate-400 border-slate-600"}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status filter tabs
// ---------------------------------------------------------------------------

const FILTER_TABS = [
  { key: "live",      label: "Live" },
  { key: "active",    label: "Active" },
  { key: "draft",     label: "Draft" },
  { key: "settled",   label: "Settled" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all",       label: "All" },
] as const;

// ---------------------------------------------------------------------------
// Purge panel
// ---------------------------------------------------------------------------

function PurgePanel({ onPurged }: { onPurged: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [days, setDays] = React.useState(7);
  const [preview, setPreview] = React.useState<{ count: number; message: string } | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);

  async function runPreview() {
    setPreviewing(true);
    setPreview(null);
    setResult(null);
    setError(null);
    setConfirmed(false);
    try {
      const res = await fetch("/api/admin/markets/purge-old-rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays: days, dryRun: true }),
      });
      const json = await res.json() as { success: boolean; count?: number; message?: string };
      if (!json.success) { setError(json.message ?? "Preview failed."); return; }
      setPreview({ count: json.count ?? 0, message: json.message ?? "" });
    } catch {
      setError("Network error.");
    } finally {
      setPreviewing(false);
    }
  }

  async function runDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/markets/purge-old-rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays: days, dryRun: false }),
      });
      const json = await res.json() as { success: boolean; deleted?: number; message?: string };
      if (!json.success) { setError(json.message ?? "Delete failed."); return; }
      setResult(json.message ?? `${json.deleted ?? 0} rounds deleted.`);
      setPreview(null);
      setConfirmed(false);
      onPurged();
    } catch {
      setError("Network error.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.03] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-400/10">
            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-400">Purge Old Rounds</p>
            <p className="text-xs text-slate-500">Permanently delete settled/cancelled short-duration rounds</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="border-t border-rose-400/10 px-5 pb-5 pt-4 space-y-4">
          <p className="text-xs text-slate-500">
            This only targets <span className="font-semibold text-slate-300">short-duration auto-rounds</span> (3–30 min) with status{" "}
            <span className="font-mono text-rose-400">settled</span> or{" "}
            <span className="font-mono text-rose-400">cancelled</span>. Long-form markets are never touched.
            All associated trades, positions, and price history are also deleted.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                Older than (days)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDays(d); setPreview(null); setResult(null); setConfirmed(false); }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                      days === d
                        ? "border-rose-400/40 bg-rose-400/10 text-rose-400"
                        : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={previewing}
              onClick={() => void runPreview()}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-white/[0.14] hover:text-white disabled:opacity-50"
            >
              {previewing ? "Checking…" : "Preview"}
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-400">{error}</p>
          )}

          {result && (
            <p className="rounded-lg border border-teal-400/20 bg-teal-400/10 px-3 py-2 text-xs text-teal-400">
              ✓ {result}
            </p>
          )}

          {preview && !result && (
            <div className="space-y-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-4">
              <p className="text-sm font-semibold text-rose-300">{preview.message}</p>

              {preview.count === 0 ? (
                <p className="text-xs text-slate-500">Nothing to delete — all short-duration rounds are newer than {days} days.</p>
              ) : (
                <>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-rose-400"
                    />
                    <span className="text-xs text-rose-300">
                      I understand this is permanent. All trades and positions for these {preview.count} round{preview.count !== 1 ? "s" : ""} will be deleted.
                    </span>
                  </label>

                  <button
                    disabled={!confirmed || deleting}
                    onClick={() => void runDelete()}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-500 disabled:opacity-40"
                  >
                    {deleting ? "Deleting…" : `Delete ${preview.count} round${preview.count !== 1 ? "s" : ""}`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminMarketsPage() {
  const [statusFilter, setStatusFilter] = React.useState("live");
  const [markets, setMarkets] = React.useState<AdminMarketRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function loadMarkets(filter: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/markets?status=${filter}`);
      if (res.ok) {
        const json = await res.json() as { markets?: AdminMarketRow[] };
        setMarkets(json.markets ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadMarkets(statusFilter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(filter: string) {
    setStatusFilter(filter);
    void loadMarkets(filter);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Markets</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Loading…" : `${markets.length} market${markets.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/admin/markets/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-900 shadow-[0_0_16px_rgba(251,191,36,0.25)] transition-all hover:bg-amber-300"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Market
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleFilterChange(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
              statusFilter === key
                ? "bg-amber-400 text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
                : "border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.14] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          Loading…
        </div>
      )}

      {/* Empty state */}
      {!loading && markets.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-20">
          <TrendingUp className="h-8 w-8 text-slate-700" />
          <p className="mt-3 text-sm text-slate-500">No markets found for this filter.</p>
          {statusFilter === "live" && (
            <Link href="/admin/markets/new" className="mt-4 text-xs font-medium text-amber-400 hover:underline">
              Create your first market →
            </Link>
          )}
        </div>
      )}

      {/* Market list */}
      {!loading && markets.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Title", "Asset", "Status", "YES / NO", "Closes", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {markets.map((market) => (
                  <tr key={market.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-medium text-slate-200 max-w-[240px] truncate">
                      {market.title}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs font-semibold text-slate-300">
                        {market.assetSymbol}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={market.status} />
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      <span className="text-teal-400">
                        {market.latestYesPrice != null ? `$${formatDecimal(market.latestYesPrice, 4)}` : "—"}
                      </span>
                      <span className="text-slate-600"> / </span>
                      <span className="text-rose-400">
                        {market.latestNoPrice != null ? `$${formatDecimal(market.latestNoPrice, 4)}` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {new Date(market.closeAt).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/markets/${market.id}/edit`}
                        className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-400"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {markets.map((market) => (
              <div key={market.id} className="rounded-xl border border-white/[0.06] bg-[#111318] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-200 leading-snug line-clamp-2">
                    {market.title}
                  </p>
                  <StatusPill status={market.status} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono font-semibold text-slate-300">
                    {market.assetSymbol}
                  </span>
                  <span className="font-mono">
                    <span className="text-teal-400">
                      {market.latestYesPrice != null ? `YES $${formatDecimal(market.latestYesPrice, 4)}` : "YES —"}
                    </span>
                    <span className="mx-1.5 text-slate-600">/</span>
                    <span className="text-rose-400">
                      {market.latestNoPrice != null ? `NO $${formatDecimal(market.latestNoPrice, 4)}` : "NO —"}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Closes {new Date(market.closeAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </p>
                  <Link
                    href={`/admin/markets/${market.id}/edit`}
                    className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-amber-400/30 hover:text-amber-400"
                  >
                    Edit →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Purge panel */}
      <PurgePanel onPurged={() => void loadMarkets(statusFilter)} />
    </div>
  );
}
