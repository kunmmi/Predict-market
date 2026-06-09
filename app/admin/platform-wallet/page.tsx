import { format } from "date-fns";
import { Wallet, ArrowUpRight, ArrowDownLeft, ArrowDownToLine, AlertTriangle, ShieldCheck } from "lucide-react";

import { requireAdmin } from "@/lib/auth/require-admin";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getPlatformWalletData } from "@/lib/services/platform-wallet-data";
import { PlatformWalletWithdrawForm } from "./withdraw-form";
import { SweepPanel } from "./sweep-panel";
import { getWithdrawalWalletBalance } from "@/lib/services/tatum-send";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "border-teal-400/20 bg-teal-400/10 text-teal-400",
    locked: "border-rose-400/20 bg-rose-400/10 text-rose-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${map[status] ?? "border-slate-600 bg-slate-800 text-slate-400"}`}>
      {status}
    </span>
  );
}

function TxTypePill({ txType }: { txType: string }) {
  const labels: Record<string, string> = {
    fee_credit:        "Platform fee",
    withdrawal_debit:  "Withdrawal",
    adjustment_credit: "Adjustment",
    adjustment_debit:  "Adjustment",
  };
  return <span className="text-xs text-slate-400">{labels[txType] ?? txType}</span>;
}

function WithdrawalStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "border-teal-400/20 bg-teal-400/10 text-teal-400",
    rejected: "border-rose-400/20 bg-rose-400/10 text-rose-400",
    pending:  "border-amber-400/20 bg-amber-400/10 text-amber-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status] ?? "border-slate-600 bg-slate-800 text-slate-400"}`}>
      {status}
    </span>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-white/[0.06] px-5 py-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
    </div>
  );
}

const LOW_BALANCE_THRESHOLD = 200; // warn when withdrawal wallet drops below $200

export default async function PlatformWalletPage() {
  await requireAdmin();
  const [{ wallet, transactions, withdrawals }, hotWallet] = await Promise.all([
    getPlatformWalletData(),
    getWithdrawalWalletBalance(),
  ]);

  const hotWalletBalance  = hotWallet ? parseFloat(hotWallet.usdtBalance) : null;
  const hotWalletIsLow    = hotWalletBalance !== null && hotWalletBalance < LOW_BALANCE_THRESHOLD;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Platform Wallet</h1>
        <p className="mt-1 text-sm text-slate-500">
          Shared treasury — platform fee inflows and admin withdrawals.
        </p>
      </div>

      {/* Withdrawal wallet low-balance warning */}
      {hotWalletIsLow && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <p className="font-semibold text-rose-400">Withdrawal wallet is low — top it up</p>
            <p className="mt-1">
              The withdrawal wallet only has{" "}
              <span className="font-mono text-white">${hotWalletBalance!.toFixed(2)} USDT</span> remaining.
              User withdrawals will fail when it runs dry. Send USDT (BSC/BEP-20) to{" "}
              <span className="font-mono text-amber-400 break-all">{hotWallet!.address}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Balance cards */}
      {wallet && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-xl border border-teal-400/30 bg-[#111318] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-400/10">
                <Wallet className="h-4 w-4 text-teal-400" />
              </div>
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-white">
              ${formatDecimal(wallet.balance, 2)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Platform Earnings</p>
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-teal-400/5" />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#111318] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10">
              <ArrowDownToLine className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-white">
              ${formatDecimal(wallet.availableBalance, 2)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Available to Withdraw</p>
          </div>

          {/* Hot wallet — pays out user withdrawals */}
          <div className={`rounded-xl border bg-[#111318] p-4 ${
            hotWalletIsLow
              ? "border-rose-400/30"
              : "border-white/[0.06]"
          }`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              hotWalletIsLow ? "bg-rose-400/10" : "bg-emerald-400/10"
            }`}>
              {hotWalletIsLow
                ? <AlertTriangle className="h-4 w-4 text-rose-400" />
                : <ShieldCheck className="h-4 w-4 text-emerald-400" />
              }
            </div>
            <p className={`mt-3 font-mono text-2xl font-semibold tracking-tight ${
              hotWalletIsLow ? "text-rose-400" : "text-white"
            }`}>
              {hotWalletBalance !== null
                ? `$${hotWalletBalance.toFixed(2)}`
                : <span className="text-slate-600 text-sm">Unavailable</span>
              }
            </p>
            <p className="mt-1 text-xs text-slate-500">Withdrawal Wallet</p>
            {hotWalletIsLow && (
              <p className="mt-1 text-[10px] text-rose-400 font-semibold uppercase tracking-wider">Low — top up needed</p>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#111318] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/50">
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-3">
              <StatusPill status={wallet.status} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Wallet Status</p>
          </div>
        </div>
      )}

      {/* On-chain sweep */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        <SectionHeader title="On-Chain USDT Sweep" />
        <div className="p-5">
          <SweepPanel />
        </div>
      </div>

      {/* Withdraw form */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        <SectionHeader title="Withdraw Funds" />
        <div className="p-5">
          <PlatformWalletWithdrawForm availableBalance={wallet?.availableBalance ?? "0"} />
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        <SectionHeader title="Recent Platform Transactions" />

        {transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-600">No platform wallet transactions yet.</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Date", "Type", "Description", "Amount", "Balance After"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 last:text-right">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">
                        {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="px-5 py-3"><TxTypePill txType={tx.transactionType} /></td>
                      <td className="px-5 py-3 text-xs text-slate-500">{tx.description ?? "—"}</td>
                      <td className={`px-5 py-3 text-right font-mono text-xs font-semibold ${tx.direction === "credit" ? "text-teal-400" : "text-rose-400"}`}>
                        {tx.direction === "credit" ? "+" : "-"}${formatDecimal(tx.amount, 2)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-slate-400">
                        ${formatDecimal(tx.balanceAfter, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-white/[0.04]">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <TxTypePill txType={tx.transactionType} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-600">{tx.description ?? "—"}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                      {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-mono text-sm font-semibold ${tx.direction === "credit" ? "text-teal-400" : "text-rose-400"}`}>
                      {tx.direction === "credit" ? "+" : "-"}${formatDecimal(tx.amount, 2)}
                    </p>
                    <p className="font-mono text-[10px] text-slate-600">${formatDecimal(tx.balanceAfter, 2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Withdrawal history */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        <SectionHeader title="Platform Withdrawal History" />

        {withdrawals.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-600">No platform withdrawals yet.</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Date", "Requested By", "Asset", "Amount", "Address", "Status"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">
                        {format(new Date(w.createdAt), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400">{w.requestedByAdminEmail}</td>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-200">{w.assetSymbol}</td>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-amber-400">
                        ${formatDecimal(w.amount, 2)}
                      </td>
                      <td className="px-5 py-3 max-w-[200px] truncate font-mono text-xs text-slate-600">
                        <span title={w.withdrawalAddress}>{w.withdrawalAddress}</span>
                      </td>
                      <td className="px-5 py-3">
                        <WithdrawalStatusPill status={w.status} />
                        {w.txHash && <p className="mt-1 font-mono text-[10px] text-slate-600">TX: {w.txHash}</p>}
                        {w.adminNotes && <p className="mt-1 text-xs text-slate-600">{w.adminNotes}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3 p-4">
              {withdrawals.map((w) => (
                <div key={w.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono font-semibold text-amber-400">${formatDecimal(w.amount, 2)}</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">{w.requestedByAdminEmail}</p>
                    </div>
                    <WithdrawalStatusPill status={w.status} />
                  </div>
                  <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">Address</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{w.withdrawalAddress}</p>
                  </div>
                  {w.txHash && (
                    <p className="font-mono text-[10px] text-slate-600">TX: {w.txHash}</p>
                  )}
                  <p className="font-mono text-[10px] text-slate-600">
                    {format(new Date(w.createdAt), "dd MMM yyyy, HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
