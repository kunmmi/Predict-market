"use client";

import * as React from "react";
import { RefreshCw, Zap, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

// ── Types mirrored from the API ────────────────────────────────────────────

type AddressPreview = {
  address: string;
  profileId: string;
  index: number | null;
  usdtBalance: string;
  bnbBalance: string;
  approved: boolean;
  wouldSweep: boolean;
};

type PreviewData = {
  masterAddress: string;
  total: number;
  toSweep: number;
  needsInit: number;
  totalPendingUsdt: string;
  addresses: AddressPreview[];
};

type SweepEntry = {
  address: string;
  profileId: string;
  action: string;
  status: "ok" | "error" | "skipped";
  detail?: string;
  txHash?: string;
  bnbTxHash?: string;
  amountUsdt?: string;
};

type SweepResult = {
  summary: {
    swept: number;
    errored: number;
    skipped: number;
    totalSweptUsdt: string;
    masterAddress: string;
  };
  results: SweepEntry[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

function bscScanTx(hash: string) {
  return `https://bscscan.com/tx/${hash}`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function StatusDot({ status }: { status: "ok" | "error" | "skipped" }) {
  const map = {
    ok:      "bg-teal-400",
    error:   "bg-rose-400",
    skipped: "bg-slate-600",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${map[status]}`} />;
}

// ── Main component ─────────────────────────────────────────────────────────

export function SweepPanel() {
  const [preview, setPreview]       = React.useState<PreviewData | null>(null);
  const [sweepResult, setSweepResult] = React.useState<SweepResult | null>(null);
  const [loading, setLoading]       = React.useState(false);
  const [error, setError]           = React.useState<string | null>(null);
  const [showAddresses, setShowAddresses] = React.useState(false);
  const [confirmed, setConfirmed]   = React.useState(false);

  // ── Preview ──────────────────────────────────────────────────────────────

  async function loadPreview() {
    setLoading(true);
    setError(null);
    setSweepResult(null);
    try {
      const res  = await fetch("/api/admin/sweep");
      const json = await res.json() as { success: boolean; message?: string } & Partial<PreviewData>;
      if (!json.success) throw new Error(json.message ?? "Preview failed.");
      setPreview({
        masterAddress:    json.masterAddress ?? "",
        total:            json.total ?? 0,
        toSweep:          json.toSweep ?? 0,
        needsInit:        json.needsInit ?? 0,
        totalPendingUsdt: json.totalPendingUsdt ?? "0.00",
        addresses:        json.addresses ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // ── Execute ──────────────────────────────────────────────────────────────

  async function executeSweep() {
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/admin/sweep", { method: "POST" });
      const json = await res.json() as { success: boolean; message?: string } & Partial<SweepResult>;
      if (!json.success) throw new Error(json.message ?? "Sweep failed.");
      setSweepResult({ summary: json.summary!, results: json.results! });
      setPreview(null);
      setConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="text-xs text-slate-400 leading-relaxed">
          <p className="font-semibold text-amber-400">Gasless sweep — how it works</p>
          <p className="mt-1">
            First time per address: master wallet sends ~0.0005 BNB once so the deposit address can approve it.
            After that, all sweeps use <code className="rounded bg-white/[0.06] px-1 text-amber-300">transferFrom</code> —
            the deposit address never needs BNB again.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* Sweep result */}
      {sweepResult && (
        <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-teal-400" />
            <p className="text-sm font-semibold text-teal-400">Sweep complete</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Swept",          value: sweepResult.summary.swept,          color: "text-teal-400" },
              { label: "USDT Collected", value: `$${sweepResult.summary.totalSweptUsdt}`, color: "text-white" },
              { label: "Errors",         value: sweepResult.summary.errored,        color: sweepResult.summary.errored > 0 ? "text-rose-400" : "text-slate-500" },
              { label: "Skipped",        value: sweepResult.summary.skipped,        color: "text-slate-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
                <p className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Per-address results */}
          <div className="rounded-xl border border-white/[0.06] bg-[#0d0f12] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["", "Address", "Action", "Amount", "TX"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sweepResult.results.filter(r => r.status !== "skipped").map((r) => (
                  <tr key={r.address} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-3 py-2"><StatusDot status={r.status} /></td>
                    <td className="px-3 py-2 font-mono text-slate-400">{shortAddr(r.address)}</td>
                    <td className="px-3 py-2 text-slate-500">{r.action}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-teal-400">
                      {r.amountUsdt ? `$${parseFloat(r.amountUsdt).toFixed(2)}` : (r.detail ?? "—")}
                    </td>
                    <td className="px-3 py-2">
                      {r.txHash ? (
                        <a
                          href={bscScanTx(r.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-amber-400 hover:underline"
                        >
                          {r.txHash.slice(0, 8)}…
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview result */}
      {preview && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0d0f12] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-white">Preview</p>
            <p className="font-mono text-xs text-slate-500">
              Master: <span className="text-amber-400">{shortAddr(preview.masterAddress)}</span>
            </p>
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4">
            {[
              { label: "Total addresses", value: preview.total },
              { label: "Has USDT to sweep", value: preview.toSweep, highlight: preview.toSweep > 0 },
              { label: "Needs first-time init", value: preview.needsInit, warn: preview.needsInit > 0 },
              { label: "Total USDT", value: `$${preview.totalPendingUsdt}`, highlight: true },
            ].map(({ label, value, highlight, warn }) => (
              <div key={label} className="bg-[#0d0f12] px-4 py-3">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
                <p className={`mt-1 font-mono text-xl font-semibold ${
                  highlight ? "text-teal-400" : warn ? "text-amber-400" : "text-white"
                }`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Init notice */}
          {preview.needsInit > 0 && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-300">
                {preview.needsInit} address{preview.needsInit !== 1 ? "es" : ""} need first-time approval (~0.0005 BNB each).
                This will be handled automatically.
              </p>
            </div>
          )}

          {/* Address list toggle */}
          {preview.addresses.filter(a => a.wouldSweep).length > 0 && (
            <div className="px-4 pb-4 mt-3">
              <button
                onClick={() => setShowAddresses((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
              >
                {showAddresses ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showAddresses ? "Hide" : "Show"} addresses ({preview.addresses.filter(a => a.wouldSweep).length})
              </button>

              {showAddresses && (
                <div className="mt-2 rounded-lg border border-white/[0.06] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {["Address", "USDT", "Approved", "Action"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {preview.addresses.filter(a => a.wouldSweep).map((a) => (
                        <tr key={a.address} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2 font-mono text-slate-400">{shortAddr(a.address)}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-teal-400">
                            ${parseFloat(a.usdtBalance).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {a.approved
                              ? <span className="text-teal-400">✓ yes</span>
                              : <span className="text-amber-400">needs init</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {a.approved ? "transferFrom" : "init + transferFrom"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {preview.toSweep === 0 && (
            <div className="px-5 pb-4 pt-2 text-sm text-slate-600">
              No deposit addresses have enough USDT to sweep right now.
            </div>
          )}

          {/* Confirm + execute */}
          {preview.toSweep > 0 && (
            <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-amber-400"
                />
                <span className="text-xs text-slate-400">
                  I confirm: sweep <strong className="text-white">${preview.totalPendingUsdt}</strong> USDT
                  from <strong className="text-white">{preview.toSweep}</strong> address
                  {preview.toSweep !== 1 ? "es" : ""} into the master wallet.
                </span>
              </label>

              <button
                disabled={!confirmed || loading}
                onClick={() => void executeSweep()}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 transition-all hover:bg-amber-300 disabled:opacity-40"
              >
                {loading ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {loading ? "Sweeping…" : "Execute Sweep"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!loading && (
        <div className="flex gap-2">
          <button
            onClick={() => void loadPreview()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-400 transition-all hover:border-white/[0.14] hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {preview ? "Refresh Preview" : "Load Preview"}
          </button>
        </div>
      )}

      {loading && !sweepResult && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-amber-400" />
          {preview ? "Executing sweep — this may take a few minutes for first-time addresses…" : "Checking balances on-chain…"}
        </div>
      )}
    </div>
  );
}
