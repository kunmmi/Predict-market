import { format } from "date-fns";

import { requireAdmin } from "@/lib/auth/require-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getPlatformWalletData } from "@/lib/services/platform-wallet-data";
import { PlatformWalletWithdrawForm } from "./withdraw-form";

function statusBadge(status: string) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "locked") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
}

function txLabel(txType: string) {
  const labels: Record<string, string> = {
    fee_credit: "Platform fee",
    withdrawal_debit: "Withdrawal",
    adjustment_credit: "Adjustment",
    adjustment_debit: "Adjustment",
  };

  return labels[txType] ?? txType;
}

function withdrawalStatusBadge(status: string) {
  if (status === "approved") return "bg-green-100 text-green-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  if (status === "pending") return "bg-yellow-100 text-yellow-800";
  return "bg-slate-100 text-slate-600";
}

export default async function PlatformWalletPage() {
  await requireAdmin();
  const { wallet, transactions, withdrawals } = await getPlatformWalletData();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="page-title">Platform wallet</h1>
        <p className="text-sm text-slate-600">
          Shared admin wallet for platform fee inflows and treasury withdrawals.
        </p>
      </div>

      {wallet ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">${formatDecimal(wallet.balance, 2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">${formatDecimal(wallet.availableBalance, 2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(wallet.status)}`}>
                {wallet.status}
              </span>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Withdraw funds</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformWalletWithdrawForm availableBalance={wallet?.availableBalance ?? "0"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent platform wallet transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500">No platform wallet transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3 text-right">Balance after</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="px-3 py-3">{txLabel(tx.transactionType)}</td>
                      <td className="px-3 py-3 text-slate-600">{tx.description ?? "—"}</td>
                      <td className={`px-3 py-3 text-right font-mono ${tx.direction === "credit" ? "text-green-600" : "text-slate-700"}`}>
                        {tx.direction === "credit" ? "+" : "-"}${formatDecimal(tx.amount, 2)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        ${formatDecimal(tx.balanceAfter, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform withdrawal history</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-slate-500">No platform withdrawals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Requested by</th>
                    <th className="px-3 py-3">Asset</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Address</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {withdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id}>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {format(new Date(withdrawal.createdAt), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{withdrawal.requestedByAdminEmail}</td>
                      <td className="px-3 py-3 font-medium">{withdrawal.assetSymbol}</td>
                      <td className="px-3 py-3 font-mono text-slate-700">
                        ${formatDecimal(withdrawal.amount, 2)}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3 font-mono text-xs text-slate-500">
                        <span title={withdrawal.withdrawalAddress}>{withdrawal.withdrawalAddress}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${withdrawalStatusBadge(withdrawal.status)}`}>
                          {withdrawal.status}
                        </span>
                        {withdrawal.txHash ? (
                          <p className="mt-1 text-xs text-slate-400">TX: {withdrawal.txHash}</p>
                        ) : null}
                        {withdrawal.adminNotes ? (
                          <p className="mt-1 text-xs text-slate-400">{withdrawal.adminNotes}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
