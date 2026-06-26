export const dynamic = "force-dynamic";

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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/helpers/cn";
import type { WalletTxType, EntryDirection } from "@/types/enums";
import { DepositPoller } from "@/components/wallet/deposit-poller";

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
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.875rem",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: isCredit ? "var(--teal)" : "var(--text-secondary)",
      }}
    >
      {isCredit ? "+" : "−"}${formatDecimal(amount)} {asset}
    </span>
  );
}

// Transaction type badge colors — all mapped to APEX CSS vars
const TX_COLOR: Partial<Record<WalletTxType, { bg: string; border: string; color: string }>> = {
  deposit:           { bg: "var(--gold-dim)",   border: "var(--border-gold)",           color: "var(--gold)"           },
  withdrawal:        { bg: "var(--rose-dim)",    border: "rgba(232,68,90,0.25)",         color: "var(--rose)"           },
  trade_debit:       { bg: "var(--bg-elevated)", border: "var(--border-subtle)",         color: "var(--text-secondary)" },
  trade_credit:      { bg: "var(--bg-elevated)", border: "var(--border-subtle)",         color: "var(--text-secondary)" },
  fee_debit:         { bg: "var(--bg-elevated)", border: "var(--border-dim)",            color: "var(--text-dim)"       },
  settlement_credit: { bg: "var(--teal-dim)",    border: "rgba(13,184,145,0.2)",         color: "var(--teal)"           },
  settlement_debit:  { bg: "var(--rose-dim)",    border: "rgba(232,68,90,0.2)",          color: "var(--rose)"           },
  commission_credit: { bg: "var(--gold-dim)",    border: "var(--border-gold)",           color: "var(--gold)"           },
  adjustment_credit: { bg: "var(--bg-elevated)", border: "var(--border-subtle)",         color: "var(--text-secondary)" },
  adjustment_debit:  { bg: "var(--bg-elevated)", border: "var(--border-subtle)",         color: "var(--text-secondary)" },
};

export default async function WalletPage() {
  const { profile } = await requireUser();
  const { wallet, transactions } = await getWalletData(profile.id);
  const locale = getLocale();
  const t = getT(locale).wallet;

  const TX_LABELS: Record<WalletTxType, string> = {
    deposit:           t.tx_deposit,
    withdrawal:        t.tx_withdrawal,
    trade_debit:       t.tx_trade_debit,
    trade_credit:      t.tx_trade_credit,
    fee_debit:         t.tx_fee_debit,
    settlement_credit: t.tx_settlement_credit,
    settlement_debit:  t.tx_settlement_debit,
    commission_credit: t.tx_commission_credit,
    adjustment_credit: t.tx_adjustment_credit,
    adjustment_debit:  t.tx_adjustment_debit,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <DepositPoller />
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/wallet/deposit" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
            <ArrowDownLeft style={{ width: 14, height: 14 }} />
            {t.deposit}
          </Link>
          <Link href="/wallet/withdraw" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
            <ArrowUpRight style={{ width: 14, height: 14 }} />
            {t.withdraw}
          </Link>
        </div>
      </div>

      {/* Balance cards */}
      {wallet ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: t.total_balance,
              value: `$${formatDecimal(wallet.balance)}`,
              sub: t.usd_equivalent,
              icon: DollarSign,
              accentColor: "var(--gold)",
              borderColor: "var(--border-gold)",
            },
            {
              label: t.available,
              value: `$${formatDecimal(wallet.availableBalance)}`,
              sub: t.ready_to_trade,
              icon: CheckCircle2,
              accentColor: "var(--teal)",
              borderColor: "rgba(13,184,145,0.25)",
            },
            {
              label: t.reserved,
              value: `$${formatDecimal(wallet.reservedBalance)}`,
              sub: t.in_open_positions,
              icon: Lock,
              accentColor: "var(--text-dim)",
              borderColor: "var(--border-subtle)",
            },
          ].map(({ label, value, sub, icon: Icon, accentColor, borderColor }) => (
            <Card key={label}>
              <CardContent style={{ paddingTop: 20, paddingBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <p style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                      fontWeight: 700, letterSpacing: "0.12em",
                      textTransform: "uppercase", color: "var(--text-dim)",
                    }}>
                      {label}
                    </p>
                    <p style={{
                      marginTop: 8,
                      fontFamily: "var(--font-mono)", fontSize: "1.75rem",
                      fontWeight: 700, letterSpacing: "-0.02em",
                      color: "var(--text-primary)",
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1,
                    }}>
                      {value}
                    </p>
                    <p style={{
                      marginTop: 4,
                      fontFamily: "var(--font-sans)", fontSize: "0.6875rem",
                      color: "var(--text-dim)",
                    }}>
                      {sub}
                    </p>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 36, height: 36, borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--bg-elevated)",
                    border: `1px solid ${borderColor}`,
                    flexShrink: 0,
                  }}>
                    <Icon style={{ width: 16, height: 16, color: accentColor }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent style={{ padding: "2rem", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--text-dim)" }}>
              {t.no_wallet}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Wallet status */}
      {wallet && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
            {t.wallet_status}
          </span>
          {wallet.status === "active" ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              borderRadius: 100,
              backgroundColor: "var(--teal-dim)",
              border: "1px solid rgba(13,184,145,0.25)",
              padding: "3px 10px",
              fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
              fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--teal)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--teal)", flexShrink: 0 }} />
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
        <h2 style={{
          fontFamily: "var(--font-display)", fontSize: "1.125rem",
          fontWeight: 600, color: "var(--text-primary)",
          marginBottom: "1rem",
        }}>
          {t.tx_history}
        </h2>

        {transactions.length === 0 ? (
          <Card>
            <CardContent style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "4rem 1rem", textAlign: "center",
            }}>
              <Clock style={{ width: 36, height: 36, color: "var(--text-dim)", marginBottom: 12 }} />
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
                {t.no_transactions}
              </p>
              <p style={{ marginTop: 4, fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                {t.deposit_to_start}
              </p>
              <Link
                href="/wallet/deposit"
                className={cn(buttonVariants({ size: "sm" }), "mt-5 gap-1.5")}
              >
                <ArrowDownLeft style={{ width: 14, height: 14 }} />
                {t.deposit}
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {[t.col_date, t.col_type, t.col_description, t.col_amount, t.col_balance_after].map((col, i) => (
                      <th
                        key={col}
                        className={i === 2 ? "hidden md:table-cell" : i === 4 ? "hidden sm:table-cell" : ""}
                        style={{
                          padding: "10px 20px",
                          textAlign: i >= 3 ? "right" : "left",
                          fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                          fontWeight: 700, letterSpacing: "0.12em",
                          textTransform: "uppercase", color: "var(--text-dim)",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const label = TX_LABELS[tx.transactionType] ?? tx.transactionType;
                    const txStyle = TX_COLOR[tx.transactionType] ?? {
                      bg: "var(--bg-elevated)",
                      border: "var(--border-subtle)",
                      color: "var(--text-dim)",
                    };
                    return (
                      <tr
                        key={tx.id}
                        style={{
                          borderBottom: "1px solid var(--border-dim)",
                          transition: "background-color 150ms ease",
                        }}
                        className="hover:bg-[var(--bg-elevated)]"
                      >
                        <td style={{ padding: "12px 20px", whiteSpace: "nowrap" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                            {format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm")}
                          </span>
                        </td>
                        <td style={{ padding: "12px 20px" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center",
                            padding: "3px 9px", borderRadius: 100,
                            fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                            fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                            backgroundColor: txStyle.bg,
                            border: `1px solid ${txStyle.border}`,
                            color: txStyle.color,
                          }}>
                            {label}
                          </span>
                        </td>
                        <td
                          className="hidden md:table-cell"
                          style={{
                            padding: "12px 20px", maxWidth: 200,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            fontFamily: "var(--font-sans)", fontSize: "0.8125rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {tx.description ?? "—"}
                        </td>
                        <td style={{ padding: "12px 20px", textAlign: "right" }}>
                          <DirectionAmount direction={tx.direction} amount={tx.amount} asset={tx.assetSymbol} />
                        </td>
                        <td
                          className="hidden sm:table-cell"
                          style={{
                            padding: "12px 20px", textAlign: "right",
                            fontFamily: "var(--font-mono)", fontSize: "0.8125rem",
                            fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)",
                          }}
                        >
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
