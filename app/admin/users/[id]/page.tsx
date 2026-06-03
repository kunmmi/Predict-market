"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ShieldCheck, ShieldOff, Copy, Check,
  Wallet, ArrowDownLeft, ArrowUpRight, BarChart2, TrendingUp, BookOpen,
} from "lucide-react";
import { format } from "date-fns";

import { formatDecimal } from "@/lib/helpers/format-decimal";
import type { AdminUserDetail } from "@/lib/services/admin-data";

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function pill(className: string, text: string) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${className}`}>
      {text}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "border-amber-400/20 bg-amber-400/10 text-amber-400",
    approved:  "border-teal-400/20 bg-teal-400/10 text-teal-400",
    rejected:  "border-rose-400/20 bg-rose-400/10 text-rose-400",
    filled:    "border-teal-400/20 bg-teal-400/10 text-teal-400",
    cancelled: "border-slate-600 bg-slate-800 text-slate-400",
    open:      "border-blue-400/20 bg-blue-400/10 text-blue-400",
    settled:   "border-violet-400/20 bg-violet-400/10 text-violet-400",
    active:    "border-teal-400/20 bg-teal-400/10 text-teal-400",
  };
  return pill(map[status] ?? "border-slate-600 bg-slate-800 text-slate-400", status);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  function copy() {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="ml-1.5 rounded p-0.5 text-slate-500 hover:text-amber-400 transition-colors">
      {copied ? <Check className="h-3 w-3 text-teal-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function SectionHeader({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05]">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-slate-400">{count}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { key: "overview",     label: "Overview",    icon: Wallet },
  { key: "trades",       label: "Trades",      icon: BarChart2 },
  { key: "positions",    label: "Positions",   icon: TrendingUp },
  { key: "deposits",     label: "Deposits",    icon: ArrowDownLeft },
  { key: "withdrawals",  label: "Withdrawals", icon: ArrowUpRight },
  { key: "ledger",       label: "Ledger",      icon: BookOpen },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ---------------------------------------------------------------------------
// Tab panels
// ---------------------------------------------------------------------------

function OverviewTab({ detail }: { detail: AdminUserDetail }) {
  const { wallet } = detail;
  const totalDeposited = detail.deposits
    .filter((d) => d.status === "approved")
    .reduce((s, d) => s + parseFloat(d.amountReceived ?? "0"), 0);
  const totalWithdrawn = detail.withdrawals
    .filter((w) => w.status === "approved")
    .reduce((s, w) => s + parseFloat(w.amount), 0);
  const totalTradeFees = detail.trades
    .reduce((s, t) => s + parseFloat(t.feeAmount), 0);

  return (
    <div className="space-y-6 p-5">
      {/* Wallet balances */}
      {wallet ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Balance",     value: `$${formatDecimal(wallet.balance, 2)}`,          highlight: true },
            { label: "Available",         value: `$${formatDecimal(wallet.availableBalance, 2)}`, highlight: false },
            { label: "Reserved",          value: `$${formatDecimal(wallet.reservedBalance, 2)}`,  highlight: false },
            { label: "Wallet Status",     value: wallet.status,                                   highlight: false, badge: true },
          ].map(({ label, value, highlight, badge }) => (
            <div key={label} className={`rounded-xl border p-4 ${highlight ? "border-teal-400/30 bg-teal-400/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
              {badge ? (
                <div className="mt-2"><StatusBadge status={value} /></div>
              ) : (
                <p className={`mt-2 font-mono text-xl font-semibold ${highlight ? "text-teal-400" : "text-slate-200"}`}>{value}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-sm text-slate-500">
          No wallet created yet.
        </div>
      )}

      {/* Deposit address */}
      {wallet?.depositAddress && (
        <div className="rounded-xl border border-white/[0.06] bg-[#111318] p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Assigned Deposit Address (BSC)</p>
          <div className="mt-2 flex items-center gap-1">
            <p className="break-all font-mono text-sm text-amber-400">{wallet.depositAddress}</p>
            <CopyButton text={wallet.depositAddress} />
          </div>
          {wallet.depositAddressIndex !== null && (
            <p className="mt-1 text-[10px] text-slate-600">Derivation index: {wallet.depositAddressIndex}</p>
          )}
        </div>
      )}

      {/* Activity stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Total Deposited",   value: `$${formatDecimal(totalDeposited, 2)}`,  sub: `${detail.deposits.length} deposits` },
          { label: "Total Withdrawn",   value: `$${formatDecimal(totalWithdrawn, 2)}`,  sub: `${detail.withdrawals.length} withdrawals` },
          { label: "Trade Fees Paid",   value: `$${formatDecimal(totalTradeFees, 4)}`,  sub: `${detail.trades.length} trades` },
          { label: "Open Positions",    value: String(detail.positions.filter((p) => p.status === "open").length), sub: "active" },
          { label: "Settled Positions", value: String(detail.positions.filter((p) => p.status === "settled").length), sub: "resolved" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
            <p className="mt-2 font-mono text-xl font-semibold text-slate-200">{value}</p>
            <p className="mt-0.5 text-[10px] text-slate-600">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradesTab({ trades }: { trades: AdminUserDetail["trades"] }) {
  if (trades.length === 0) return <Empty text="No trades yet." />;
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Date", "Market", "Side", "Amount", "Price", "Units", "Fee", "Status"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {trades.map((t) => (
              <tr key={t.id} className="transition-colors hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">
                  {format(new Date(t.createdAt), "dd MMM yy, HH:mm")}
                </td>
                <td className="px-5 py-3 max-w-[180px] truncate text-xs text-slate-300">{t.marketTitle}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.side === "yes" ? "border-teal-400/20 bg-teal-400/10 text-teal-400" : "border-rose-400/20 bg-rose-400/10 text-rose-400"}`}>
                    {t.side === "yes" ? "UP" : "DOWN"}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-200">${formatDecimal(t.amount, 2)}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-400">${formatDecimal(t.price, 4)}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-400">{formatDecimal(t.positionUnits, 4)}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-600">${formatDecimal(t.feeAmount, 4)}</td>
                <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile */}
      <div className="md:hidden space-y-3 p-4">
        {trades.map((t) => (
          <div key={t.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-slate-300 line-clamp-2">{t.marketTitle}</p>
              <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.side === "yes" ? "border-teal-400/20 bg-teal-400/10 text-teal-400" : "border-rose-400/20 bg-rose-400/10 text-rose-400"}`}>
                {t.side === "yes" ? "UP" : "DOWN"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-slate-200">${formatDecimal(t.amount, 2)}</span>
              <StatusBadge status={t.status} />
            </div>
            <p className="font-mono text-[10px] text-slate-600">{format(new Date(t.createdAt), "dd MMM yy, HH:mm")}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function PositionsTab({ positions }: { positions: AdminUserDetail["positions"] }) {
  if (positions.length === 0) return <Empty text="No positions yet." />;
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Last Updated", "Market", "Market Status", "YES Units", "NO Units", "P&L", "Status"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {positions.map((pos) => {
              const pnl = parseFloat(pos.pnlAmount);
              return (
                <tr key={pos.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">
                    {format(new Date(pos.updatedAt), "dd MMM yy, HH:mm")}
                  </td>
                  <td className="px-5 py-3 max-w-[200px] truncate text-xs text-slate-300">{pos.marketTitle}</td>
                  <td className="px-5 py-3"><StatusBadge status={pos.marketStatus} /></td>
                  <td className="px-5 py-3 font-mono text-xs text-teal-400">{formatDecimal(pos.yesUnits, 4)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-rose-400">{formatDecimal(pos.noUnits, 4)}</td>
                  <td className={`px-5 py-3 font-mono text-xs font-semibold ${pnl > 0 ? "text-teal-400" : pnl < 0 ? "text-rose-400" : "text-slate-500"}`}>
                    {pnl > 0 ? "+" : ""}{formatDecimal(pos.pnlAmount, 2)}
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={pos.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Mobile */}
      <div className="md:hidden space-y-3 p-4">
        {positions.map((pos) => {
          const pnl = parseFloat(pos.pnlAmount);
          return (
            <div key={pos.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-300 line-clamp-2">{pos.marketTitle}</p>
                <StatusBadge status={pos.status} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                  <p className="text-[9px] text-slate-600">YES</p>
                  <p className="font-mono text-xs text-teal-400">{formatDecimal(pos.yesUnits, 4)}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                  <p className="text-[9px] text-slate-600">NO</p>
                  <p className="font-mono text-xs text-rose-400">{formatDecimal(pos.noUnits, 4)}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                  <p className="text-[9px] text-slate-600">P&L</p>
                  <p className={`font-mono text-xs font-semibold ${pnl > 0 ? "text-teal-400" : pnl < 0 ? "text-rose-400" : "text-slate-500"}`}>
                    {pnl > 0 ? "+" : ""}{formatDecimal(pos.pnlAmount, 2)}
                  </p>
                </div>
              </div>
              <p className="font-mono text-[10px] text-slate-600">{format(new Date(pos.updatedAt), "dd MMM yy, HH:mm")}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DepositsTab({ deposits }: { deposits: AdminUserDetail["deposits"] }) {
  if (deposits.length === 0) return <Empty text="No deposits yet." />;
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Date", "Asset", "Network", "Expected", "Received", "TX Hash", "Status"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {deposits.map((d) => (
              <tr key={d.id} className="transition-colors hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">
                  {format(new Date(d.createdAt), "dd MMM yy, HH:mm")}
                </td>
                <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-200">{d.assetSymbol}</td>
                <td className="px-5 py-3 text-xs text-slate-500">{d.networkName ?? "—"}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-400">{d.amountExpected ?? "—"}</td>
                <td className="px-5 py-3 font-mono text-xs font-semibold text-teal-400">{d.amountReceived ?? "—"}</td>
                <td className="px-5 py-3 max-w-[120px] font-mono text-xs text-slate-600">
                  {d.txHash ? (
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={d.txHash}>{d.txHash.slice(0, 10)}…</span>
                      <CopyButton text={d.txHash} />
                    </div>
                  ) : "—"}
                </td>
                <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile */}
      <div className="md:hidden space-y-3 p-4">
        {deposits.map((d) => (
          <div key={d.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-teal-400">{d.amountReceived ?? d.amountExpected ?? "—"}</span>
              <StatusBadge status={d.status} />
            </div>
            <div className="flex gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-300">{d.assetSymbol}</span>
              <span>{d.networkName ?? ""}</span>
            </div>
            {d.txHash && (
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-600">
                <span className="truncate">{d.txHash}</span>
                <CopyButton text={d.txHash} />
              </div>
            )}
            <p className="font-mono text-[10px] text-slate-600">{format(new Date(d.createdAt), "dd MMM yy, HH:mm")}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function WithdrawalsTab({ withdrawals }: { withdrawals: AdminUserDetail["withdrawals"] }) {
  if (withdrawals.length === 0) return <Empty text="No withdrawals yet." />;
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Date", "Asset", "Amount", "Wallet Address", "TX Hash", "Status"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {withdrawals.map((w) => (
              <tr key={w.id} className="transition-colors hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">
                  {format(new Date(w.createdAt), "dd MMM yy, HH:mm")}
                </td>
                <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-200">{w.assetSymbol}</td>
                <td className="px-5 py-3 font-mono text-xs font-semibold text-amber-400">${formatDecimal(w.amount, 2)}</td>
                <td className="px-5 py-3 max-w-[160px] font-mono text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <span className="truncate" title={w.withdrawalAddress}>{w.withdrawalAddress.slice(0, 12)}…</span>
                    <CopyButton text={w.withdrawalAddress} />
                  </div>
                </td>
                <td className="px-5 py-3 max-w-[120px] font-mono text-xs text-slate-600">
                  {w.txHash ? (
                    <div className="flex items-center gap-1">
                      <span className="truncate" title={w.txHash}>{w.txHash.slice(0, 10)}…</span>
                      <CopyButton text={w.txHash} />
                    </div>
                  ) : "—"}
                </td>
                <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile */}
      <div className="md:hidden space-y-3 p-4">
        {withdrawals.map((w) => (
          <div key={w.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-amber-400">${formatDecimal(w.amount, 2)}</span>
              <StatusBadge status={w.status} />
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
              <span className="truncate">{w.withdrawalAddress}</span>
              <CopyButton text={w.withdrawalAddress} />
            </div>
            {w.txHash && (
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-600">
                <span className="truncate">{w.txHash}</span>
                <CopyButton text={w.txHash} />
              </div>
            )}
            <p className="font-mono text-[10px] text-slate-600">{format(new Date(w.createdAt), "dd MMM yy, HH:mm")}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function LedgerTab({ transactions }: { transactions: AdminUserDetail["walletTransactions"] }) {
  if (transactions.length === 0) return <Empty text="No ledger entries yet." />;

  const txLabels: Record<string, string> = {
    deposit_credit:     "Deposit",
    withdrawal_debit:   "Withdrawal",
    trade_debit:        "Trade (buy)",
    trade_credit:       "Trade (sell)",
    payout_credit:      "Payout",
    fee_debit:          "Fee",
    refund_credit:      "Refund",
    adjustment_credit:  "Adjustment",
    adjustment_debit:   "Adjustment",
  };

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Date", "Type", "Description", "Amount", "Balance After"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 last:text-right whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {transactions.map((tx) => (
              <tr key={tx.id} className="transition-colors hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">
                  {format(new Date(tx.createdAt), "dd MMM yy, HH:mm")}
                </td>
                <td className="px-5 py-3 text-xs text-slate-400">{txLabels[tx.transactionType] ?? tx.transactionType}</td>
                <td className="px-5 py-3 text-xs text-slate-500">{tx.description ?? "—"}</td>
                <td className={`px-5 py-3 text-right font-mono text-xs font-semibold ${tx.direction === "credit" ? "text-teal-400" : "text-rose-400"}`}>
                  {tx.direction === "credit" ? "+" : "-"}${formatDecimal(tx.amount, 4)}
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
              <p className="text-xs text-slate-400">{txLabels[tx.transactionType] ?? tx.transactionType}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-600">{tx.description ?? "—"}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-600">{format(new Date(tx.createdAt), "dd MMM yy, HH:mm")}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`font-mono text-sm font-semibold ${tx.direction === "credit" ? "text-teal-400" : "text-rose-400"}`}>
                {tx.direction === "credit" ? "+" : "-"}${formatDecimal(tx.amount, 4)}
              </p>
              <p className="font-mono text-[10px] text-slate-600">${formatDecimal(tx.balanceAfter, 2)}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-slate-600">{text}</div>;
}

// ---------------------------------------------------------------------------
// Role toggle
// ---------------------------------------------------------------------------

function RoleToggleButton({
  userId, role, onUpdated,
}: {
  userId: string;
  role: string;
  onUpdated: (newRole: string) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isAdmin = role === "admin";

  async function toggle() {
    const newRole = isAdmin ? "user" : "admin";
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) { setError(json.message ?? "Failed."); return; }
      onUpdated(newRole);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        disabled={loading}
        onClick={() => void toggle()}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
          isAdmin
            ? "border-rose-400/20 bg-rose-400/10 text-rose-400 hover:bg-rose-400/20"
            : "border-teal-400/20 bg-teal-400/10 text-teal-400 hover:bg-teal-400/20"
        }`}
      >
        {loading ? (
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
        ) : isAdmin ? (
          <ShieldOff className="h-3 w-3" />
        ) : (
          <ShieldCheck className="h-3 w-3" />
        )}
        {loading ? "Saving…" : isAdmin ? "Remove admin" : "Make admin"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = React.useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabKey>("overview");

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/users/${params.id}`);
        if (res.status === 404) { setNotFound(true); return; }
        const json = await res.json() as { success: boolean } & AdminUserDetail;
        if (json.success) {
          setDetail({
            profile: json.profile,
            wallet: json.wallet,
            walletTransactions: json.walletTransactions,
            deposits: json.deposits,
            withdrawals: json.withdrawals,
            trades: json.trades,
            positions: json.positions,
          });
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        Loading user…
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-500">User not found.</p>
        <button onClick={() => router.back()} className="mt-3 text-xs text-amber-400 hover:underline">← Back</button>
      </div>
    );
  }

  const { profile } = detail;

  const tabCounts: Partial<Record<TabKey, number>> = {
    trades:      detail.trades.length,
    positions:   detail.positions.length,
    deposits:    detail.deposits.length,
    withdrawals: detail.withdrawals.length,
    ledger:      detail.walletTransactions.length,
  };

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition-colors hover:border-white/[0.14] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{profile.email}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Joined {format(new Date(profile.createdAt), "dd MMM yyyy")}
            {profile.displayName ? ` · ${profile.displayName}` : ""}
          </p>
        </div>
      </div>

      {/* Profile strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-[#111318] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
            profile.role === "admin"
              ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
              : "border-slate-600 bg-slate-800 text-slate-400"
          }`}>
            {profile.role === "admin" && <ShieldCheck className="h-3 w-3" />}
            {profile.role}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
            profile.kycStatus === "approved" ? "border-teal-400/20 bg-teal-400/10 text-teal-400" :
            profile.kycStatus === "pending"  ? "border-amber-400/20 bg-amber-400/10 text-amber-400" :
            "border-rose-400/20 bg-rose-400/10 text-rose-400"
          }`}>
            KYC: {profile.kycStatus}
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <RoleToggleButton
            userId={profile.id}
            role={profile.role}
            onUpdated={(newRole) =>
              setDetail((d) => d ? { ...d, profile: { ...d.profile, role: newRole } } : d)
            }
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === key
                ? "bg-amber-400 text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
                : "border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.14] hover:text-white"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
            {tabCounts[key] !== undefined && (
              <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${activeTab === key ? "bg-slate-900/30" : "bg-white/[0.06]"}`}>
                {tabCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        <SectionHeader
          icon={TABS.find((t) => t.key === activeTab)!.icon}
          title={TABS.find((t) => t.key === activeTab)!.label}
          count={tabCounts[activeTab]}
        />
        {activeTab === "overview"    && <OverviewTab detail={detail} />}
        {activeTab === "trades"      && <TradesTab trades={detail.trades} />}
        {activeTab === "positions"   && <PositionsTab positions={detail.positions} />}
        {activeTab === "deposits"    && <DepositsTab deposits={detail.deposits} />}
        {activeTab === "withdrawals" && <WithdrawalsTab withdrawals={detail.withdrawals} />}
        {activeTab === "ledger"      && <LedgerTab transactions={detail.walletTransactions} />}
      </div>
    </div>
  );
}
