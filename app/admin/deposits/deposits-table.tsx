"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { AdminDepositRow } from "@/lib/services/admin-data";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "border-amber-400/20 bg-amber-400/10 text-amber-400",
    approved:  "border-teal-400/20 bg-teal-400/10 text-teal-400",
    rejected:  "border-rose-400/20 bg-rose-400/10 text-rose-400",
    cancelled: "border-slate-600 bg-slate-800 text-slate-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status] ?? "border-slate-600 bg-slate-800 text-slate-400"}`}>
      {status}
    </span>
  );
}

function ActionPanel({ deposit, onDone }: { deposit: AdminDepositRow; onDone: () => void }) {
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
    const body = action === "approve"
      ? { amountReceived: amount, notes: notes || undefined }
      : { notes: notes || undefined };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);
    if (!res.ok || !json?.success) { setError(json?.message ?? "Action failed."); return; }
    onDone();
  }

  if (mode === "idle") {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setMode("approve")}
          className="rounded-lg border border-teal-400/20 bg-teal-400/10 px-3 py-1.5 text-xs font-semibold text-teal-400 transition-colors hover:bg-teal-400/20"
        >
          Approve
        </button>
        <button
          onClick={() => setMode("reject")}
          className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-400/20"
        >
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <p className={`text-[10px] font-bold uppercase tracking-widest ${mode === "approve" ? "text-teal-400" : "text-rose-400"}`}>
        {mode === "approve" ? "Approve deposit" : "Reject deposit"}
      </p>
      {mode === "approve" && (
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Amount received *</label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-slate-200 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none"
            placeholder="0.00"
          />
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs text-slate-500">Admin notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none"
          placeholder="e.g. Verified on-chain"
        />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={loading}
          onClick={() => void submit(mode)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-opacity ${
            mode === "approve" ? "bg-teal-600 hover:bg-teal-500" : "bg-rose-600 hover:bg-rose-500"
          }`}
        >
          {loading ? "Saving…" : mode === "approve" ? "Confirm" : "Confirm rejection"}
        </button>
        <button
          disabled={loading}
          onClick={() => { setMode("idle"); setError(null); }}
          className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const FILTERS = ["pending", "approved", "rejected", "all"] as const;

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
    } finally { setLoading(false); }
  }

  function handleFilterChange(status: string) {
    setStatusFilter(status);
    void loadDeposits(status);
  }

  function handleActionDone() {
    router.refresh();
    void loadDeposits(statusFilter);
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
              statusFilter === f
                ? "bg-amber-400 text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
                : "border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.14] hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          Loading…
        </div>
      )}

      {!loading && deposits.length === 0 && (
        <div className="py-16 text-center text-sm text-slate-600">
          No deposits with status &quot;{statusFilter}&quot;.
        </div>
      )}

      {!loading && deposits.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Date", "User", "Asset", "Network", "Expected", "Received", "TX Hash", "Status", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {deposits.map((d) => (
                  <tr key={d.id} className="align-top transition-colors hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                      {format(new Date(d.createdAt), "dd MMM yy, HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{d.userEmail}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-200">{d.assetSymbol}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{d.networkName ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{d.amountExpected ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-teal-400">{d.amountReceived ?? "—"}</td>
                    <td className="px-4 py-3 max-w-[120px] truncate font-mono text-xs text-slate-600">
                      <span title={d.txHash ?? ""}>{d.txHash ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                      {d.adminNotes && <p className="mt-1 text-xs text-slate-600">{d.adminNotes}</p>}
                    </td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <ActionPanel deposit={d} onDone={handleActionDone} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {deposits.map((d) => (
              <div key={d.id} className="rounded-xl border border-white/[0.06] bg-[#111318] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-slate-200 break-all">{d.userEmail}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                      {format(new Date(d.createdAt), "dd MMM yy, HH:mm")}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Asset",    value: d.assetSymbol,        mono: true },
                    { label: "Network",  value: d.networkName ?? "—", mono: false },
                    { label: "Expected", value: d.amountExpected ?? "—", mono: true },
                    { label: "Received", value: d.amountReceived ?? "—", mono: true, highlight: true },
                  ].map(({ label, value, mono, highlight }) => (
                    <div key={label} className="rounded-lg bg-white/[0.03] px-3 py-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
                      <p className={`mt-0.5 text-xs font-semibold ${mono ? "font-mono" : ""} ${highlight ? "text-teal-400" : "text-slate-300"}`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {d.txHash && (
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">TX Hash</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{d.txHash}</p>
                  </div>
                )}

                {d.adminNotes && (
                  <p className="text-xs text-slate-500">{d.adminNotes}</p>
                )}

                <ActionPanel deposit={d} onDone={handleActionDone} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
