"use client";

import * as React from "react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { WithdrawalSummary } from "@/lib/services/withdrawal-data";
import type { Locale, T } from "@/lib/i18n/translations";
import { statusLabel } from "@/lib/i18n/labels";
import { useWallet } from "@/lib/contexts/wallet-context";
import {
  FIXED_WITHDRAWAL_ASSET,
  FIXED_WITHDRAWAL_NETWORK,
} from "@/lib/validations/withdrawal";

function StatusBadge({ status, locale }: { status: string; locale: Locale }) {
  const styles: Record<string, React.CSSProperties> = {
    pending:   { backgroundColor: "var(--gold-dim)",  color: "var(--gold)",          border: "1px solid var(--border-gold)" },
    approved:  { backgroundColor: "var(--teal-dim)",  color: "var(--teal)",          border: "1px solid rgba(13,184,145,0.25)" },
    rejected:  { backgroundColor: "var(--rose-dim)",  color: "var(--rose)",          border: "1px solid rgba(232,68,90,0.25)" },
    cancelled: { backgroundColor: "var(--bg-elevated)", color: "var(--text-dim)",    border: "1px solid var(--border-subtle)" },
  };
  const style = styles[status] ?? styles.cancelled;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        borderRadius: 6, padding: "2px 8px",
        fontSize: "0.75rem", fontWeight: 500,
        ...style,
      }}
    >
      {statusLabel(status, locale)}
    </span>
  );
}

export function WithdrawPageClient({ t, locale }: { t: T["withdraw"]; locale: Locale }) {
  const [amount, setAmount] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    txHash: string;
    cryptoAmount: string;
    asset: string;
  } | null>(null);

  const [history, setHistory] = React.useState<WithdrawalSummary[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(true);

  // Shared wallet state — no per-component fetch
  const { wallet, loading: walletLoading, refetch: refetchWallet } = useWallet();
  const availableBalance = wallet ? Number(wallet.availableBalance) : null;

  // After a successful withdrawal, refresh the shared wallet so balance updates
  React.useEffect(() => {
    if (result) void refetchWallet();
  }, [result, refetchWallet]);

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
  const isValidAmount = !isNaN(amountNum) && amountNum >= 0.30;
  const insufficientFunds =
    isValidAmount && availableBalance != null && amountNum > availableBalance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidAmount) {
      setError("Minimum withdrawal is $0.30.");
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
          asset_symbol: FIXED_WITHDRAWAL_ASSET,
          network_name: FIXED_WITHDRAWAL_NETWORK,
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
              <div style={{ borderRadius: 8, border: "1px solid rgba(13,184,145,0.3)", backgroundColor: "var(--teal-dim)", padding: "12px 16px", fontSize: "0.875rem", color: "var(--teal)" }}>
                <p className="font-semibold">{t.success_title}</p>
                <p className="mt-1">
                  <span className="font-medium">{result.cryptoAmount} {result.asset}</span> {t.success_sub}
                </p>
                <p className="mt-2 text-xs" style={{ color: "var(--teal)", opacity: 0.85 }}>
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
                <div style={{ borderRadius: 8, border: "1px solid rgba(232,68,90,0.3)", backgroundColor: "var(--rose-dim)", padding: "12px 16px", fontSize: "0.875rem", color: "var(--rose)" }}>
                  {error}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>{t.label_asset}</label>
                  <Input value={FIXED_WITHDRAWAL_ASSET} readOnly style={{ opacity: 0.7 }} />
                </div>
                <div className="space-y-1">
                  <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>{t.label_network}</label>
                  <Input value={FIXED_WITHDRAWAL_NETWORK} readOnly style={{ opacity: 0.7 }} />
                  <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{t.hint_network}</p>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>{t.label_amount} *</label>
                <Input
                  type="number"
                  min="0.30"
                  step="0.01"
                  placeholder="100.00"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setError(null); }}
                  required
                />
                {walletLoading ? (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{t.loading_balance}</p>
                ) : availableBalance != null ? (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    {t.available} ${availableBalance.toFixed(2)}
                    {insufficientFunds && (
                      <span style={{ marginLeft: 4, fontWeight: 500, color: "var(--rose)" }}>{t.insufficient}</span>
                    )}
                  </p>
                ) : null}
              </div>

              {/* Wallet address */}
              <div className="space-y-1">
                <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>{t.label_address} *</label>
                <Input
                  placeholder="e.g. 0x1a2b3c… or bc1q…"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setError(null); }}
                  required
                />
                <p style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{t.hint_address}</p>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>{t.label_notes}</label>
                <textarea
                  rows={2}
                  placeholder={locale === "zh" ? "如有额外信息请填写…" : "Any additional information for the admin…"}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-elevated)",
                    color: "var(--text-primary)",
                    padding: "8px 12px",
                    fontSize: "0.875rem",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Info box */}
              <div style={{ borderRadius: 8, border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-elevated)", padding: "12px 16px", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
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
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{t.history_title}</h2>

        {historyLoading ? (
          <p style={{ fontSize: "0.875rem", color: "var(--text-dim)" }}>{t.loading_balance}</p>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center" style={{ fontSize: "0.875rem", color: "var(--text-dim)" }}>
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
                        <StatusBadge status={w.status} locale={locale} />
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
