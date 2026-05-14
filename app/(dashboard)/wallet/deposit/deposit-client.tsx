"use client";

import * as React from "react";
import { format } from "date-fns";
import { Copy, Check, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DepositStatus } from "@/types/enums";
import type { Locale, T } from "@/lib/i18n/translations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DepositRow = {
  id: string;
  assetSymbol: string;
  networkName: string | null;
  amountExpected: string | null;
  amountReceived: string | null;
  txHash: string | null;
  status: DepositStatus;
  adminNotes: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status, t }: { status: DepositStatus; t: T["deposit"] }) {
  const map: Record<DepositStatus, { label: string; className: string }> = {
    pending:   { label: t.status_pending,   className: "bg-yellow-100 text-yellow-800" },
    approved:  { label: t.status_approved,  className: "bg-green-100 text-green-800" },
    rejected:  { label: t.status_rejected,  className: "bg-red-100 text-red-800" },
    cancelled: { label: t.status_cancelled, className: "bg-slate-100 text-slate-600" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Unique deposit address panel
// ---------------------------------------------------------------------------

function UniqueAddressDeposit({ t, locale }: { t: T["deposit"]; locale: Locale }) {
  const [address, setAddress] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function loadAddress() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/deposit-address");
      const json = (await res.json()) as { success?: boolean; address?: string; message?: string };
      if (!res.ok || !json.success || !json.address) {
        throw new Error(json.message ?? "Failed to load deposit address");
      }
      setAddress(json.address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { void loadAddress(); }, []);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = address;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
        <RefreshCw className="h-4 w-4 animate-spin" />
        {t.loading_address}
      </div>
    );
  }

  if (error || !address) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error ?? "Could not load deposit address."}</p>
        <Button variant="outline" size="sm" onClick={loadAddress}>
          {locale === "zh" ? "重试" : "Retry"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Address card */}
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
            {locale === "zh" ? "您的专属 BSC 充值地址（USDT BEP-20）" : "Your BSC deposit address (USDT BEP-20)"}
          </p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-900 leading-relaxed">
            {address}
          </p>
        </div>
        <Button
          onClick={copyAddress}
          className="w-full gap-2"
          variant={copied ? "outline" : "default"}
        >
          {copied ? (
            <><Check className="h-4 w-4" />{t.copied}</>
          ) : (
            <><Copy className="h-4 w-4" />{t.copy}</>
          )}
        </Button>
      </div>

      {/* Instructions */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <p className="font-semibold text-slate-800">
          {locale === "zh" ? "如何充值" : "How to deposit"}
        </p>
        <ol className="space-y-2 text-slate-600 list-none">
          {(locale === "zh" ? [
            "从任意交易所（币安、OKX 等）或钱包发送 USDT 到上方地址",
            "网络必须选择 BNB Smart Chain（BEP-20）",
            "链上确认后余额自动到账，无需其他操作",
          ] : [
            "Send USDT to the address above from any exchange (Binance, OKX, etc.) or wallet",
            "Network must be BNB Smart Chain (BEP-20)",
            "Your balance updates automatically once confirmed on-chain — no further steps needed",
          ]).map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-slate-900">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          ⚠️{" "}
          {locale === "zh"
            ? "仅支持 BEP-20 USDT。发送其他代币或使用错误网络将导致资产损失。"
            : "Only BEP-20 USDT is supported. Sending other tokens or using the wrong network will result in permanent loss."}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deposit history
// ---------------------------------------------------------------------------

function DepositHistory({ deposits, t, locale }: {
  deposits: DepositRow[];
  t: T["deposit"];
  locale: Locale;
}) {
  if (deposits.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{t.no_requests}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="hidden px-3 py-3 sm:table-cell sm:px-4">{t.col_date}</th>
            <th className="px-3 py-3 sm:px-4">{t.col_asset}</th>
            <th className="px-3 py-3 sm:px-4">{t.col_amount}</th>
            <th className="px-3 py-3 sm:px-4">{t.col_status}</th>
            <th className="hidden px-3 py-3 md:table-cell sm:px-4">{t.col_notes}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {deposits.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className="hidden whitespace-nowrap px-3 py-3 text-slate-500 sm:table-cell sm:px-4">
                {format(new Date(d.createdAt), "dd MMM yyyy, HH:mm")}
              </td>
              <td className="px-3 py-3 font-medium sm:px-4">{d.assetSymbol}</td>
              <td className="px-3 py-3 font-mono sm:px-4">
                {d.amountReceived != null
                  ? d.amountReceived
                  : d.amountExpected != null
                    ? `~${d.amountExpected}`
                    : "—"}
              </td>
              <td className="px-3 py-3 sm:px-4">
                <StatusBadge status={d.status} t={t} />
              </td>
              <td className="hidden px-3 py-3 text-slate-500 md:table-cell sm:px-4">
                {d.txHash ? (
                  <a
                    href={`https://bscscan.com/tx/${d.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-600 underline"
                  >
                    {d.txHash.slice(0, 10)}…
                  </a>
                ) : (d.adminNotes ?? "—")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export function DepositPageClient({ t, locale }: { t: T["deposit"]; locale: Locale }) {
  const [deposits, setDeposits] = React.useState<DepositRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function loadDeposits() {
    try {
      const res = await fetch("/api/deposits");
      if (res.ok) {
        const json = (await res.json()) as { deposits?: DepositRow[] };
        setDeposits(json.deposits ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { void loadDeposits(); }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">{t.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "USDT 充值地址" : "USDT Deposit Address"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UniqueAddressDeposit t={t} locale={locale} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">{t.your_requests}</h2>
        <Card>
          {loading ? (
            <CardContent className="py-6 text-center text-sm text-slate-400">
              {t.loading}
            </CardContent>
          ) : (
            <DepositHistory deposits={deposits} t={t} locale={locale} />
          )}
        </Card>
      </div>
    </div>
  );
}
