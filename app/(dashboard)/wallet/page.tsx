import Link from "next/link";
import { format } from "date-fns";
import { DollarSign, CheckCircle2, Lock, ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { getWalletData } from "@/lib/services/wallet-data";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/helpers/cn";
import type { WalletTxType, EntryDirection } from "@/types/enums";

function DirectionAmount({
  direction,
  amount,
  asset,
}: {
  direction: EntryDirection;
  amount: string;
  asset: string;
}) {
  const isCredit = direction === "credit";
  return (
    <span className={`font-mono text-sm font-semibold tabular-nums ${isCredit ? "text-green-600" : "text-slate-700"}`}>
      {isCredit ? "+" : "−"}${formatDecimal(amount)} {asset}
    </span>
  );
}

export default async function WalletPage() {
  const { profile } = await requireUser();
  const { wallet, transactions } = await getWalletData(profile.id);
  const locale = getLocale();
  const t = getT(locale).wallet;

  const TX_LABELS: Record<WalletTxType, string> = {
    deposit: t.tx_deposit,
    withdrawal: t.tx_withdrawal,
    trade_debit: t.tx_trade_debit,
    trade_credit: t.tx_trade_credit,
    fee_debit: t.tx_fee_debit,
    settlement_credit: t.tx_settlement_credit,
    settlement_debit: t.tx_settlement_debit,
    commission_credit: t.tx_commission_credit,
    adjustment_credit: t.tx_adjustment_credit,
    adjustment_debit: t.tx_adjustment_debit,
  };

  const colorMap: Partial<Record<WalletTxType, string>> = {
    deposit: "bg-yellow-100 text-yellow-800",
    withdrawal: "bg-orange-100 text-orange-700",
    trade_debit: "bg-slate-200 text-slate-700",
    trade_credit: "bg-slate-200 text-slate-700",
    fee_debit: "bg-slate-100 text-slate-600",
    settlement_credit: "bg-green-100 text-green-700",
    settlement_debit: "bg-orange-100 text-orange-700",
    commission_credit: "bg-amber-100 text-amber-800",
    adjustment_credit: "bg-slate-100 text-slate-600",
    adjustment_debit: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/wallet/deposit"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <ArrowDownLeft className="h-4 w-4" />
            {t.deposit}
          </Link>
          <Link
            href="/wallet/withdraw"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <ArrowUpRight className="h-4 w-4" />
            {t.withdraw}
          </Link>
        </div>
      </div>

      {/* Balance cards */}
      {wallet ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t.total_balance}</p>
                  <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
                    ${formatDecimal(wallet.balance)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{t.usd_equivalent}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100">
                  <DollarSign className="h-4 w-4 text-yellow-800" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t.available}</p>
                  <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
                    ${formatDecimal(wallet.availableBalance)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{t.ready_to_trade}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t.reserved}</p>
                  <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums">
                    ${formatDecimal(wallet.reservedBalance)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{t.in_open_positions}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
                  <Lock className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            {t.no_wallet}
          </CardContent>
        </Card>
      )}

      {wallet && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{t.wallet_status}</span>
          {wallet.status === "active" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {t.status_active}
            </span>
          ) : wallet.status === "locked" ? (
            <Badge variant="destructive">{t.status_locked}</Badge>
          ) : (
            <Badge variant="secondary">{wallet.status}</Badge>
          )}
        </div>
      )}

      {/* Transaction history */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">{t.tx_history}</h2>
        </div>

        {transactions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">{t.no_transactions}</p>
              <p className="mt-1 text-xs text-slate-400">{t.deposit_to_start}</p>
              <Link
                href="/wallet/deposit"
                className={cn(buttonVariants({ size: "sm" }), "mt-5 gap-1.5")}
              >
                <ArrowDownLeft className="h-4 w-4" />
                {t.deposit}
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3 sm:px-5 sm:py-3.5">{t.col_date}</th>
                    <th className="px-3 py-3 sm:px-5 sm:py-3.5">{t.col_type}</th>
                    <th className="hidden px-3 py-3 md:table-cell sm:px-5 sm:py-3.5">{t.col_description}</th>
                    <th className="px-3 py-3 text-right sm:px-5 sm:py-3.5">{t.col_amount}</th>
                    <th className="hidden px-3 py-3 text-right sm:table-cell sm:px-5 sm:py-3.5">{t.col_balance_after}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map((tx) => {
                    const label = TX_LABELS[tx.transactionType] ?? tx.transactionType;
                    const color = colorMap[tx.transactionType] ?? "bg-slate-100 text-slate-600";
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-400 sm:px-5 sm:py-3.5">
                          {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm")}
                        </td>
                        <td className="px-3 py-3 sm:px-5 sm:py-3.5">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>
                            {label}
                          </span>
                        </td>
                        <td className="hidden max-w-[200px] truncate px-3 py-3 text-slate-600 md:table-cell sm:px-5 sm:py-3.5">
                          {tx.description ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right sm:px-5 sm:py-3.5">
                          <DirectionAmount
                            direction={tx.direction}
                            amount={tx.amount}
                            asset={tx.assetSymbol}
                          />
                        </td>
                        <td className="hidden px-3 py-3 text-right font-mono tabular-nums text-slate-600 sm:table-cell sm:px-5 sm:py-3.5">
                          ${formatDecimal(tx.balanceAfter)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
