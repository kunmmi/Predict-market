"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import type { AdminCommissionRow } from "@/lib/services/admin-data";

const STATUS_TABS = ["all", "pending", "approved", "paid"] as const;

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "paid"
      ? "default"
      : status === "approved"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{status}</Badge>;
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
        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-slate-200 py-10 text-center text-sm text-slate-500">
          No commissions found.{" "}
          {filter === "all" && "Commissions are generated when fee-bearing trades are placed."}
        </div>
      ) : (
        <div className="surface-panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="pb-3 pr-4">Promoter</th>
                <th className="pb-3 pr-4">Promo Code</th>
                <th className="pb-3 pr-4">Referred User</th>
                <th className="pb-3 pr-4">Commission</th>
                <th className="pb-3 pr-4">Rate</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-700">{c.promoterEmail}</td>
                  <td className="py-3 pr-4">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {c.promoterPromoCode}
                    </code>
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{c.referredProfileEmail}</td>
                  <td className="py-3 pr-4 font-medium text-slate-800">
                    ${formatDecimal(c.commissionAmount, 4)}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {(parseFloat(c.commissionRate) * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {new Date(c.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      {c.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating === c.id}
                          onClick={() => updateStatus(c.id, "approved")}
                          className="text-xs"
                        >
                          Approve
                        </Button>
                      )}
                      {(c.status === "pending" || c.status === "approved") && (
                        <Button
                          size="sm"
                          disabled={updating === c.id}
                          onClick={() => updateStatus(c.id, "paid")}
                          className="text-xs"
                        >
                          Mark Paid
                        </Button>
                      )}
                      {c.status === "paid" && (
                        <span className="text-xs text-slate-400">
                          {c.paidAt
                            ? new Date(c.paidAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
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
      )}
    </div>
  );
}
