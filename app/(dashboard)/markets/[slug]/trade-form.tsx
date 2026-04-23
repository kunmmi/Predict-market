"use client";

import { useState, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale, T } from "@/lib/i18n/translations";
import { sideLabel } from "@/lib/i18n/labels";

type TradeSide = "yes" | "no";

type WalletData = {
  availableBalance: string;
  status: string;
};

type Props = {
  marketId: string;
  yesPrice: string | null;
  noPrice: string | null;
  marketStatus: string;
  locale: Locale;
  t: T["trade"];
};

const FEE_RATE = 0.02; // 2%

export function TradeForm({ marketId, yesPrice, noPrice, marketStatus, locale, t }: Props) {
  const [side, setSide] = useState<TradeSide>("yes");
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchWallet() {
      try {
        const res = await fetch("/api/wallet");
        if (res.ok) {
          const json = await res.json();
          setWallet(json.wallet);
        }
      } finally {
        setWalletLoading(false);
      }
    }
    fetchWallet();
  }, [success]);

  const currentPrice = side === "yes" ? yesPrice : noPrice;
  const priceNum = currentPrice != null ? parseFloat(currentPrice) : null;
  const amountNum = parseFloat(amount);
  const isValidAmount = !isNaN(amountNum) && amountNum > 0;

  const estimatedUnits =
    isValidAmount && priceNum != null && priceNum > 0
      ? (amountNum / priceNum).toFixed(4)
      : null;
  const fee = isValidAmount ? (amountNum * FEE_RATE).toFixed(4) : null;
  const totalDebit = isValidAmount ? (amountNum + amountNum * FEE_RATE).toFixed(4) : null;

  const availableBalance =
    wallet != null ? parseFloat(wallet.availableBalance) : null;
  const insufficientFunds =
    isValidAmount && availableBalance != null && amountNum > availableBalance;

  if (marketStatus !== "active") {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!isValidAmount) {
      setError("Please enter a valid amount.");
      return;
    }
    if (priceNum == null) {
      setError("Market price is not available. Please wait for an admin to set prices.");
      return;
    }
    if (insufficientFunds) {
      setError("Insufficient available balance.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market_id: marketId,
          side,
          amount: String(amountNum),
          price: String(priceNum),
          fee_amount: fee ?? "0",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Trade failed. Please try again.");
        return;
      }
      setSuccess(true);
      setAmount("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="space-y-4">
            <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              {t.success}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSuccess(false);
                setAmount("");
              }}
            >
              {t.place_another}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Side Toggle */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">{t.side}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSide("yes")}
                  className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-colors ${
                    side === "yes"
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {sideLabel("yes", locale)} {yesPrice != null ? `@ $${parseFloat(yesPrice).toFixed(2)}` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setSide("no")}
                  className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-colors ${
                    side === "no"
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {sideLabel("no", locale)} {noPrice != null ? `@ $${parseFloat(noPrice).toFixed(2)}` : ""}
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">{t.amount_label}</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="10.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
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

            {/* Summary */}
            {isValidAmount && priceNum != null && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="space-y-1 text-slate-700">
                  <div className="flex justify-between">
                    <span>{t.est_units}</span>
                    <span className="font-medium">{estimatedUnits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.fee}</span>
                    <span className="font-medium">${fee}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1">
                    <span className="font-medium">{t.total_debit}</span>
                    <span className="font-semibold">${totalDebit}</span>
                  </div>
                </div>
              </div>
            )}

            {priceNum == null && (
              <p className="text-sm text-amber-600">{t.no_price}</p>
            )}

            <Button
              type="submit"
              disabled={loading || insufficientFunds || priceNum == null || !isValidAmount}
              className="w-full"
            >
              {loading
                ? t.placing
                : `${sideLabel(side, locale)} — $${isValidAmount ? amountNum.toFixed(2) : "0.00"}`}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
