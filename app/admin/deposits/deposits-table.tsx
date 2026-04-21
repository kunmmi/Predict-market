"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import type { AdminDepositRow } from "@/lib/services/admin-data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DepositStatus = "pending" | "approved" | "rejected" | "cancelled";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
    approved: { label: "Approved", className: "bg-green-100 text-green-800" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
    cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-600" },
  };
  const { label, className } = map[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action panel — inline approve / reject form per row
// ---------------------------------------------------------------------------

function ActionPanel({
  deposit,
  onDone,
}: {
  deposit: AdminDepositRow;
  onDone: () => void;
}) {
  const [mode, setMode] = React.useState<"idle" | "approve" | "reject">("idle");
  const [amount, setAmount] = React.useState(deposit.amountExpected ?? "");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (deposit.status !== "pending") return null;

  async function submit(action: "approve" | "reject") {
    setLoading(true);
    setError(null);

    const url = `/api/admin/deposits/${deposit.id}/${action}`;
    const body =
      action === "approve"
        ? { amountReceived: amount, notes: notes || undefined }
        : { notes: notes || undefined };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      message?: string;
    } | null;

    setLoading(false);

    if (!res.ok || !json?.success) {
      setError(json?.message ?? "Action failed.");
      return;
    }

    onDone();
  }

  if (mode === "idle") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setMode("approve")}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={() => setMode("reject")}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {mode === "approve" ? "Approve deposit" : "Reject deposit"}
      </p>

      {mode === "approve" && (
        <div className="space-y-1">
          <label htmlFor="deposit-amount-received" className="text-xs text-slate-600">
            Amount received *
          </label>
          <input
            id="deposit-amount-received"
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono"
            placeholder="0.00"
          />
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="deposit-admin-notes" className="text-xs text-slate-600">
          Admin notes (optional)
        </label>
        <textarea
          id="deposit-admin-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm resize-none"
          placeholder="e.g. Verified on-chain"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          disabled={loading}
          onClick={() => void submit(mode)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${
            mode === "approve"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {loading ? "Saving..." : mode === "approve" ? "Confirm approval" : "Confirm rejection"}
        </button>
        <button
          disabled={loading}
          onClick={() => { setMode("idle"); setError(null); }}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deposits table
// ---------------------------------------------------------------------------

export function DepositsTable({ initialDeposits }: { initialDeposits: AdminDepositRow[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<string>("pending");
  const [deposits, setDeposits] = React.useState<AdminDepositRow[]>(initialDeposits);
  const [loading, setLoading] = React.useState(false);

  async function loadDeposits(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deposits?status=${status}`);
      if (res.ok) {
        const json = (await res.json()) as { deposits?: AdminDepositRow[] };
        setDeposits(json.deposits ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(status: string) {
    setStatusFilter(status);
    void loadDeposits(status);
  }

  function handleActionDone() {
    router.refresh();
    void loadDeposits(statusFilter);
  }

  const FILTERS = ["pending", "approved", "rejected", "all"];

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              statusFilter === f
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm text-slate-400">Loading...</p>
      )}

      {!loading && deposits.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          No deposits with status &quot;{statusFilter}&quot;.
        </p>
      )}

      {!loading && deposits.length > 0 && (
        <div className="surface-panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Network</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">TX hash</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {deposits.map((d) => (
                <tr key={d.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {format(new Date(d.createdAt), "dd MMM yy, HH:mm")}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{d.userEmail}</td>
                  <td className="px-4 py-3 font-medium">{d.assetSymbol}</td>
                  <td className="px-4 py-3 text-slate-500">{d.networkName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">
                    {d.amountExpected ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {d.amountReceived ?? "—"}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-slate-500">
                    {d.txHash ? (
                      <span title={d.txHash}>{d.txHash}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                    {d.adminNotes && (
                      <p className="mt-1 text-xs text-slate-400">{d.adminNotes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 min-w-[200px]">
                    <ActionPanel deposit={d} onDone={handleActionDone} />
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
