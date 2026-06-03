export const dynamic = "force-dynamic";

import Link from "next/link";
import { TrendingUp, Plus } from "lucide-react";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getAllMarketsAdmin } from "@/lib/services/market-data";
import { formatDecimal } from "@/lib/helpers/format-decimal";

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

export default async function AdminMarketsPage() {
  await requireAdmin();
  const markets = await getAllMarketsAdmin();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Markets</h1>
          <p className="mt-1 text-sm text-slate-500">
            {markets.length} market{markets.length !== 1 ? "s" : ""} total
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

      {markets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-20">
          <TrendingUp className="h-8 w-8 text-slate-700" />
          <p className="mt-3 text-sm text-slate-500">No markets yet.</p>
          <Link href="/admin/markets/new" className="mt-4 text-xs font-medium text-amber-400 hover:underline">
            Create your first market →
          </Link>
        </div>
      ) : (
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
    </div>
  );
}
