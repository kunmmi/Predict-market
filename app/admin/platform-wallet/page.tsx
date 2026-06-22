import { format } from "date-fns";
import { Wallet, ArrowDownLeft, ArrowUpRight, AlertTriangle, ShieldCheck, TrendingUp, Info } from "lucide-react";

import { requireAdmin } from "@/lib/auth/require-admin";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getPlatformWalletData } from "@/lib/services/platform-wallet-data";
import { SweepPanel } from "./sweep-panel";
import { getWithdrawalWalletBalance } from "@/lib/services/tatum-send";
import { getLocale } from "@/lib/i18n/get-locale";

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

function TxTypePill({ txType, isZh }: { txType: string; isZh: boolean }) {
  const labels: Record<string, [string, string]> = {
    fee_credit:        ["Fee / Stake",   "手续费 / 投注"],
    payout_debit:      ["Winner payout", "获奖派彩"],
    withdrawal_debit:  ["Withdrawal",    "提现"],
    adjustment_credit: ["Adjustment",    "调整"],
    adjustment_debit:  ["Adjustment",    "调整"],
  };
  const pair = labels[txType];
  return <span className="text-xs text-slate-400">{pair ? (isZh ? pair[1] : pair[0]) : txType}</span>;
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
  const locale = getLocale();
  const isZh = locale === "zh";
  const [{ wallet, totalUserBalances, transactions }, hotWallet] = await Promise.all([
    getPlatformWalletData(),
    getWithdrawalWalletBalance(),
  ]);

  const hotWalletBalance  = hotWallet ? parseFloat(hotWallet.usdtBalance) : null;
  const hotWalletIsLow    = hotWalletBalance !== null && hotWalletBalance < LOW_BALANCE_THRESHOLD;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{isZh ? "平台钱包" : "Platform Wallet"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isZh ? "平台收益账本 — 已结算市场的手续费及输家投注。" : "Platform earnings ledger — fees and loser stakes accumulated from settled markets."}
        </p>
      </div>

      {/* Net Profit Banner */}
      {wallet && (() => {
        const platformEarnings = parseFloat(wallet.balance);
        const owed             = parseFloat(totalUserBalances);
        return (
          <div className="rounded-xl border border-gold/30 bg-gradient-to-r from-amber-500/10 to-transparent p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">{isZh ? "可提现利润" : "Your Withdrawable Profit"}</p>
                </div>
                <p className="mt-2 font-mono text-4xl font-bold tracking-tight text-white">
                  ${formatDecimal(platformEarnings, 2)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {isZh ? "来自已结算市场的手续费 + 输家投注" : "Accumulated from trading fees + loser stakes on settled markets"}
                </p>
              </div>
              <div className="shrink-0 rounded-lg border border-white/[0.06] bg-[#111318] p-3 text-xs text-slate-500 space-y-1 min-w-[200px]">
                <p className="font-semibold text-slate-300 mb-2">{isZh ? "如何阅读此页面" : "How to read this page"}</p>
                <p><span className="text-amber-400 font-semibold">{isZh ? "利润" : "Profit"}</span> {isZh ? "= 手续费 + 输家投注。通过主钱包提现。" : "= fees + loser stakes. Withdraw via master wallet."}</p>
                <p><span className="text-violet-400 font-semibold">{isZh ? "玩家余额" : "Player balances"}</span> {isZh ? "= 您欠用户的资金。须留存于主钱包。" : "= what you owe users. Must stay in master wallet."}</p>
                <p><span className="text-teal-400 font-semibold">{isZh ? "归集" : "Sweep"}</span> {isZh ? "= 链上归集玩家充值。非利润。" : "= consolidates player deposits on-chain. Not profit."}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Withdrawal wallet low-balance warning */}
      {hotWalletIsLow && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <p className="font-semibold text-rose-400">{isZh ? "提现钱包余额不足 — 请及时充值" : "Withdrawal wallet is low — top it up"}</p>
            <p className="mt-1">
              {isZh ? "提现钱包仅剩" : "The withdrawal wallet only has"}{" "}
              <span className="font-mono text-white">${hotWalletBalance!.toFixed(2)} USDT</span>{" "}
              {isZh ? "，耗尽后用户提现将失败。请向以下地址发送 USDT（BSC/BEP-20）：" : "remaining. User withdrawals will fail when it runs dry. Send USDT (BSC/BEP-20) to"}{" "}
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
            <p className="mt-1 text-xs text-slate-500">{isZh ? "平台收益（手续费 + 输家投注）" : "Platform Earnings (Fees + Loser Stakes)"}</p>
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-teal-400/5" />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#111318] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/10">
              <ArrowDownLeft className="h-4 w-4 text-violet-400" />
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-white">
              ${formatDecimal(totalUserBalances, 2)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{isZh ? "用户总余额" : "Total User Balances"}</p>
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
                : <span className="text-slate-600 text-sm">{isZh ? "不可用" : "Unavailable"}</span>
              }
            </p>
            <p className="mt-1 text-xs text-slate-500">{isZh ? "提现钱包" : "Withdrawal Wallet"}</p>
            {hotWalletIsLow && (
              <p className="mt-1 text-[10px] text-rose-400 font-semibold uppercase tracking-wider">{isZh ? "余额不足 — 请充值" : "Low — top up needed"}</p>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#111318] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/50">
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-3">
              <StatusPill status={wallet.status} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{isZh ? "钱包状态" : "Wallet Status"}</p>
          </div>
        </div>
      )}

      {/* On-chain sweep */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        <SectionHeader title={isZh ? "链上 USDT 归集" : "On-Chain USDT Sweep"} />
        <div className="flex items-start gap-2 border-b border-white/[0.06] bg-blue-400/5 px-5 py-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
          <p className="text-xs text-slate-500">
            {isZh
              ? <>将玩家充值地址的 USDT 归集至您的主钱包。<span className="text-slate-400">这不是您的利润</span> — 其中包含玩家仍可提现的资金。您的利润显示在上方。</>
              : <>This consolidates USDT from player deposit addresses into your master wallet.{" "}<span className="text-slate-400">It is not your profit</span> — it includes all player funds (balances they can still withdraw). Your profit is shown above.</>
            }
          </p>
        </div>
        <div className="p-5">
          <SweepPanel />
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden">
        <SectionHeader title={isZh ? "近期平台交易" : "Recent Platform Transactions"} />

        {transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-600">{isZh ? "暂无平台钱包交易记录。" : "No platform wallet transactions yet."}</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {(isZh ? ["日期", "类型", "描述", "金额", "操作后余额"] : ["Date", "Type", "Description", "Amount", "Balance After"]).map((h) => (
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
                      <td className="px-5 py-3"><TxTypePill txType={tx.transactionType} isZh={isZh} /></td>
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
                      <TxTypePill txType={tx.transactionType} isZh={isZh} />
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
    </div>
  );
}
