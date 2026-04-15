"use client";

import * as React from "react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { WithdrawalSummary } from "@/lib/services/withdrawal-data";
import type { Locale, T } from "@/lib/i18n/translations";

const ASSETS = ["BTC", "USDT", "USDC", "BNB", "SOL"] as const;
type Asset = (typeof ASSETS)[number];

type NetworkOption = { label: string; value: string; sub: string };
const NETWORK_OPTIONS: Record<string, NetworkOption[]> = {
  BTC:  [{ label: "Bitcoin", value: "Bitcoin",                  sub: "Native" }],
  USDT: [
    { label: "ETH", value: "Ethereum (ERC-20)",        sub: "ERC-20" },
    { label: "BSC", value: "BNB Smart Chain (BEP-20)", sub: "BEP-20" },
    { label: "SOL", value: "Solana (SPL)",              sub: "SPL" },
  ],
  USDC: [
    { label: "ETH", value: "Ethereum (ERC-20)",        sub: "ERC-20" },
    { label: "BSC", value: "BNB Smart Chain (BEP-20)", sub: "BEP-20" },
    { label: "SOL", value: "Solana (SPL)",              sub: "SPL" },
  ],
  BNB:  [{ label: "BSC",    value: "BNB Smart Chain (BEP-20)", sub: "BEP-20" }],
  SOL:  [{ label: "Solana", value: "Solana",                    sub: "Native" }],
};

function NetworkPicker({
  asset,
  value,
  onChange,
}: {
  asset: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = NETWORK_OPTIONS[asset] ?? [];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              isSelected
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            <span>{opt.label}</span>
            <span className={`text-[10px] font-normal ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
              {opt.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    cancelled: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function WithdrawPageClient({ t, locale }: { t: T["withdraw"]; locale: Locale }) {
  const [asset, setAsset] = React.useState<Asset>("USDT");
  const [network, setNetwork] = React.useState<string>(NETWORK_OPTIONS["USDT"][0].value);
  const [amount, setAmount] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [availableBalance, setAvailableBalance] = React.useState<number | null>(null);
  const [walletLoading, setWalletLoading] = React.useState(true);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    txHash: string;
    cryptoAmount: string;
    asset: string;
  } | null>(null);

  const [history, setHistory] = React.useState<WithdrawalSummary[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(true);

  // Auto-select first network when asset changes
  React.useEffect(() => {
    const first = NETWORK_OPTIONS[asset]?.[0]?.value ?? "";
    setNetwork(first);
  }, [asset]);

  React.useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((j) => {
        if (j.wallet) setAvailableBalance(Number(j.wallet.availableBalance));
      })
      .finally(() => setWalletLoading(false));
  }, [result]);

  const loadHistory = React.useCallback(() => {
    setHistoryLoading(true);
    fetch("/api/withdrawals")
      .then((r) => r.json())
      .then((j) => setHistory(j.withdrawals ?? []))
      .finally(() => setHistoryLoading(false));
  }, []);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory, result]);

  const amountNum = parseFloat(amount);
  const isValidAmount = !isNaN(amountNum) && amountNum > 0;
  const insufficientFunds =
    isValidAmount && availableBalance != null && amountNum > availableBalance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidAmount) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!address.trim()) {
      setError("Please enter your wallet address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_symbol: asset,
          network_name: network.trim() || null,
          amount: String(amountNum),
          withdrawal_address: address.trim(),
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Failed to submit withdrawal.");
        return;
      }
      setResult({ txHash: json.txHash, cryptoAmount: json.cryptoAmount, asset: json.asset });
      setAmount("");
      setAddress("");
      setNetwork("");
      setNotes("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">{t.subtitle}</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t.new_request}</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <p className="font-semibold">{t.success_title}</p>
                <p className="mt-1">
                  <span className="font-medium">{result.cryptoAmount} {result.asset}</span> {t.success_sub}
                </p>
                <p className="mt-2 text-xs text-green-700">
                  {t.success_tx}{" "}
                  <span className="break-all font-mono">{result.txHash}</span>
                </p>
              </div>
              <Button variant="outline" onClick={() => setResult(null)}>
                {t.make_another}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Asset */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t.label_asset} *</label>
                <div className="flex flex-wrap gap-2">
                  {ASSETS.map((a) => {
                    const isSelected = asset === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAsset(a)}
                        className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Network */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t.label_network}</label>
                <NetworkPicker asset={asset} value={network} onChange={setNetwork} />
                <p className="text-xs text-slate-500">{t.hint_network}</p>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">{t.label_amount} *</label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="100.00"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setError(null); }}
                  required
                />
                {walletLoading ? (
                  <p className="text-xs text-slate-400">{t.loading_balance}</p>
                ) : availableBalance != null ? (
                  <p className="text-xs text-slate-500">
                    {t.available} ${availableBalance.toFixed(2)}
                    {insufficientFunds && (
                      <span className="ml-1 font-medium text-red-600">{t.insufficient}</span>
                    )}
                  </p>
                ) : null}
              </div>

              {/* Wallet address */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">{t.label_address} *</label>
                <Input
                  placeholder="e.g. 0x1a2b3c… or bc1q…"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setError(null); }}
                  required
                />
                <p className="text-xs text-slate-500">{t.hint_address}</p>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">{t.label_notes}</label>
                <textarea
                  rows={2}
                  placeholder={locale === "zh" ? "如有额外信息请填写…" : "Any additional information for the admin…"}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              {/* Info box */}
              <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <p className="font-medium">{t.how_it_works}</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5 text-xs">
                  <li>{t.hint_1}</li>
                  <li>{t.hint_2}</li>
                  <li>{t.hint_3}</li>
                  <li>{t.hint_4}</li>
                </ul>
              </div>

              <Button
                type="submit"
                disabled={submitting || insufficientFunds || !isValidAmount || !address.trim()}
                className="w-full"
              >
                {submitting ? t.submitting : t.submit}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">{t.history_title}</h2>

        {historyLoading ? (
          <p className="text-sm text-slate-400">{t.loading_balance}</p>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              {t.no_history}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="hidden px-3 py-3 sm:table-cell sm:px-4">{t.col_date}</th>
                    <th className="px-3 py-3 sm:px-4">{t.col_asset}</th>
                    <th className="px-3 py-3 sm:px-4">{t.col_amount}</th>
                    <th className="hidden px-3 py-3 md:table-cell sm:px-4">{t.col_address}</th>
                    <th className="hidden px-3 py-3 md:table-cell sm:px-4">{t.col_tx_hash}</th>
                    <th className="px-3 py-3 sm:px-4">{t.col_status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="hidden whitespace-nowrap px-3 py-3 text-slate-500 sm:table-cell sm:px-4">
                        {format(new Date(w.createdAt), "dd MMM yy, HH:mm")}
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <Badge variant="secondary" className="text-xs">{w.assetSymbol}</Badge>
                        {w.networkName && (
                          <p className="mt-0.5 text-xs text-slate-400">{w.networkName}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono font-medium text-slate-800 sm:px-4">
                        ${Number(w.amount).toFixed(2)}
                      </td>
                      <td className="hidden max-w-[140px] truncate px-3 py-3 font-mono text-xs text-slate-500 md:table-cell sm:px-4">
                        <span title={w.withdrawalAddress}>{w.withdrawalAddress}</span>
                      </td>
                      <td className="hidden max-w-[140px] truncate px-3 py-3 font-mono text-xs text-slate-500 md:table-cell sm:px-4">
                        {w.txHash ? <span title={w.txHash}>{w.txHash}</span> : "—"}
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <StatusBadge status={w.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
