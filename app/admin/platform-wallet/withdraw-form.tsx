"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIXED_WITHDRAWAL_ASSET,
  FIXED_WITHDRAWAL_NETWORK,
} from "@/lib/validations/withdrawal";

type Props = {
  availableBalance: string;
};

export function PlatformWalletWithdrawForm({ availableBalance }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [withdrawalAddress, setWithdrawalAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/admin/platform-wallet/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset_symbol: FIXED_WITHDRAWAL_ASSET,
        network_name: FIXED_WITHDRAWAL_NETWORK,
        amount,
        withdrawal_address: withdrawalAddress.trim(),
        notes: notes.trim() || null,
      }),
    });

    const json = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; txHash?: string }
      | null;

    setLoading(false);

    if (!response.ok || !json?.success) {
      setError(json?.message ?? "Withdrawal failed.");
      return;
    }

    setSuccess(json.txHash ? `Sent successfully. TX: ${json.txHash}` : "Withdrawal sent successfully.");
    setAmount("");
    setWithdrawalAddress("");
    setNotes("");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none transition-colors";
  const readonlyClass =
    "w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 font-mono text-sm text-slate-500 cursor-default";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-slate-500";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClass}>Asset</label>
          <input value={FIXED_WITHDRAWAL_ASSET} readOnly className={readonlyClass} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Network</label>
          <input value={FIXED_WITHDRAWAL_NETWORK} readOnly className={readonlyClass} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClass}>Amount (USD)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            placeholder="0.00"
          />
          <p className="text-xs text-slate-600">
            Available:{" "}
            <span className="font-mono text-slate-400">${availableBalance}</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Destination Address</label>
          <input
            value={withdrawalAddress}
            onChange={(e) => setWithdrawalAddress(e.target.value)}
            className={inputClass}
            placeholder="Paste destination wallet address"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
          placeholder="Internal note about this withdrawal"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-teal-400/20 bg-teal-400/10 px-3 py-2 text-xs text-teal-400">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-[0_0_16px_rgba(251,191,36,0.2)] transition-all hover:bg-amber-300 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Withdraw from Platform Wallet"}
      </button>
    </form>
  );
}
