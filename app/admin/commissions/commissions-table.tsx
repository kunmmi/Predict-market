"use client";

import { useState } from "react";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import type { AdminCommissionRow } from "@/lib/services/admin-data";

const STATUS_TABS = ["all", "pending", "approved", "paid"] as const;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:     "border-teal-400/20 bg-teal-400/10 text-teal-400",
    approved: "border-blue-400/20 bg-blue-400/10 text-blue-400",
    pending:  "border-amber-400/20 bg-amber-400/10 text-amber-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status] ?? "border-slate-600 bg-slate-800 text-slate-400"}`}>
      {status}
    </span>
  );
}

export function CommissionsTable({
  initialCommissions,
}: {
  initialCommissions: AdminCommissionRow[];
}) {
  const [commissions, setCommissions] = useState(initialCommissions);
  const [filter, setFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered =
    filter === "all" ? commissions : commissions.filter((c) => c.status === filter);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/commissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Update failed.");
        return;
      }
      setCommissions((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status,
                approvedAt: status === "approved" ? new Date().toISOString() : c.approvedAt,
                paidAt: status === "paid" ? new Date().toISOString() : c.paidAt,
              }
            : c,
        ),
      );
    } catch {
      setError("Network error.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
              filter === tab
                ? "bg-amber-400 text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
                : "border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.14] hover:text-white"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-600">
          No commissions found.{" "}
          {filter === "all" && "Commissions are generated when fee-bearing trades are placed."}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Promoter", "Promo Code", "Referred User", "Commission", "Rate", "Status", "Date", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-slate-300">{c.promoterEmail}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-violet-400/10 px-2 py-0.5 font-mono text-xs font-semibold text-violet-400 border border-violet-400/20">
                        {c.promoterPromoCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{c.referredProfileEmail}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-teal-400">
                      ${formatDecimal(c.commissionAmount, 4)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {(parseFloat(c.commissionRate) * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {c.status === "pending" && (
                          <button
                            disabled={updating === c.id}
                            onClick={() => updateStatus(c.id, "approved")}
                            className="rounded-lg border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-400/20 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {(c.status === "pending" || c.status === "approved") && (
                          <button
                            disabled={updating === c.id}
                            onClick={() => updateStatus(c.id, "paid")}
                            className="rounded-lg border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 text-xs font-semibold text-teal-400 transition-colors hover:bg-teal-400/20 disabled:opacity-50"
                          >
                            Mark Paid
                          </button>
                        )}
                        {c.status === "paid" && (
                          <span className="text-xs text-slate-600">
                            {c.paidAt
                              ? new Date(c.paidAt).toLocaleDateString("en-US", {
                                  month: "short", day: "numeric",
                                })
                              : "Paid"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {filtered.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/[0.06] bg-[#111318] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-slate-200">{c.promoterEmail}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{c.referredProfileEmail}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <span className="inline-flex rounded-md bg-violet-400/10 px-2 py-0.5 font-mono text-xs font-semibold text-violet-400 border border-violet-400/20">
                  {c.promoterPromoCode}
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Commission</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-teal-400">
                      ${formatDecimal(c.commissionAmount, 4)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Rate</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-slate-200">
                      {(parseFloat(c.commissionRate) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {c.status === "pending" && (
                      <button
                        disabled={updating === c.id}
                        onClick={() => updateStatus(c.id, "approved")}
                        className="rounded-lg border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-400/20 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    {(c.status === "pending" || c.status === "approved") && (
                      <button
                        disabled={updating === c.id}
                        onClick={() => updateStatus(c.id, "paid")}
                        className="rounded-lg border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 text-xs font-semibold text-teal-400 transition-colors hover:bg-teal-400/20 disabled:opacity-50"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                  <span className="font-mono text-xs text-slate-600">
                    {new Date(c.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
