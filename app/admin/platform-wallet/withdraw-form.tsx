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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Asset</label>
          <input
            value={FIXED_WITHDRAWAL_ASSET}
            readOnly
            className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Network</label>
          <input
            value={FIXED_WITHDRAWAL_NETWORK}
            readOnly
            className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Amount (USD)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="0.00"
          />
          <p className="text-xs text-slate-500">Available: ${availableBalance}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Destination wallet address</label>
          <input
            value={withdrawalAddress}
            onChange={(e) => setWithdrawalAddress(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Paste destination address"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Optional internal note"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Sending..." : "Withdraw from platform wallet"}
      </button>
    </form>
  );
}
