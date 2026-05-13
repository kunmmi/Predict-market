"use client";

import * as React from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DepositStatus } from "@/types/enums";
import type { Locale, T } from "@/lib/i18n/translations";

// USDT BEP-20 contract on BSC mainnet
const USDT_BSC_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const BSC_CHAIN_ID = "0x38";
const BSC_CHAIN_ID_DEC = 56;

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
// Unique deposit address card
// ---------------------------------------------------------------------------

function UniqueAddressDeposit({ locale }: { locale: Locale }) {
  const [address, setAddress] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/wallet/deposit-address")
      .then((r) => r.json())
      .then((json: { success?: boolean; address?: string }) => {
        if (json.success && json.address) setAddress(json.address);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function copyAddress() {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const zh = locale === "zh";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        {zh
          ? "将 USDT（BSC BEP-20）发送到您的专属地址，余额将在链上确认后自动到账，无需任何额外操作。"
          : "Send USDT (BSC BEP-20) to your personal address. Your balance is credited automatically once confirmed on-chain — no form needed."}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {zh ? "您的专属充值地址（BSC · USDT BEP-20）" : "Your deposit address (BSC · USDT BEP-20)"}
        </p>

        {loading ? (
          <div className="h-8 w-full animate-pulse rounded-md bg-slate-100" />
        ) : address ? (
          <>
            <p className="break-all rounded-lg bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 select-all">
              {address}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={copyAddress}
              className="w-full"
            >
              {copied
                ? (zh ? "✓ 已复制" : "✓ Copied!")
                : (zh ? "复制地址" : "Copy address")}
            </Button>
          </>
        ) : (
          <p className="text-sm text-red-600">
            {zh ? "无法生成地址，请刷新页面重试。" : "Could not generate address. Please refresh and try again."}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-1.5 text-sm text-amber-800">
        <p className="font-semibold">{zh ? "注意事项" : "Important"}</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>{zh ? "仅支持 BNB Smart Chain（BSC）网络" : "Only send on BNB Smart Chain (BSC) network"}</li>
          <li>{zh ? "仅支持 USDT（BEP-20）代币" : "Only send USDT (BEP-20) token"}</li>
          <li>{zh ? "发送其他代币或使用其他网络将导致资金丢失" : "Sending other tokens or using other networks will result in permanent loss"}</li>
          <li>{zh ? "最低充值金额：1 USDT" : "Minimum deposit: 1 USDT"}</li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetaMask / wallet-connect option (secondary)
// ---------------------------------------------------------------------------

type WalletState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; address: string }
  | { status: "error"; message: string };

type DepositStep =
  | { step: "idle" }
  | { step: "sending" }
  | { step: "submitted"; txHash: string }
  | { step: "error"; message: string };

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function MetaMaskDeposit({ locale, onSuccess }: { locale: Locale; onSuccess: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [wallet, setWallet] = React.useState<WalletState>({ status: "idle" });
  const [depositStep, setDepositStep] = React.useState<DepositStep>({ step: "idle" });
  const [amount, setAmount] = React.useState("");
  const [platformAddress, setPlatformAddress] = React.useState<string | null>(null);
  const [balance, setBalance] = React.useState<string | null>(null);

  const zh = locale === "zh";

  React.useEffect(() => {
    fetch("/api/config/deposit-addresses")
      .then((r) => r.json())
      .then((json: { addresses?: Record<string, { address: string | null }> }) => {
        setPlatformAddress(json.addresses?.["USDT"]?.address ?? null);
      })
      .catch(() => {});
  }, []);

  async function connectWallet() {
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) {
      setWallet({ status: "error", message: zh ? "未检测到钱包，请使用 Trust Wallet 或 MetaMask 打开此页面。" : "No wallet detected. Open in Trust Wallet or install MetaMask." });
      return;
    }
    setWallet({ status: "connecting" });
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" }) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No account returned");

      const chainId = await eth.request({ method: "eth_chainId" }) as string;
      if (chainId !== BSC_CHAIN_ID) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_CHAIN_ID }] });
        } catch {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: BSC_CHAIN_ID,
              chainName: "BNB Smart Chain",
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: ["https://bsc-dataseed.binance.org/"],
              blockExplorerUrls: ["https://bscscan.com/"],
            }],
          });
        }
      }

      setWallet({ status: "connected", address });

      // Fetch USDT balance
      const data = "0x70a08231" + address.slice(2).padStart(64, "0");
      const result = await eth.request({ method: "eth_call", params: [{ to: USDT_BSC_ADDRESS, data }, "latest"] }) as string;
      setBalance((Number(BigInt(result)) / 1e18).toFixed(2));
    } catch (err) {
      setWallet({ status: "error", message: err instanceof Error ? err.message : "Connection failed" });
    }
  }

  async function sendDeposit() {
    if (wallet.status !== "connected" || !platformAddress) return;
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return;

    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) return;

    setDepositStep({ step: "sending" });
    try {
      const toAddr = platformAddress.slice(2).padStart(64, "0");
      const amountWei = BigInt(Math.round(amountNum * 1e18));
      const amountHex = amountWei.toString(16).padStart(64, "0");
      const calldata = "0xa9059cbb" + toAddr + amountHex;

      const txHash = await eth.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.address, to: USDT_BSC_ADDRESS, data: calldata, chainId: BSC_CHAIN_ID_DEC }],
      }) as string;

      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_symbol: "USDT", network_name: "BNB Smart Chain (BEP-20)", amount_expected: amount, tx_hash: txHash, sender_wallet: wallet.address }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; depositId?: string; message?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.message ?? "Failed to record deposit");

      if (json.depositId) {
        setTimeout(async () => {
          await fetch("/api/deposits/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deposit_id: json.depositId }) });
          onSuccess();
        }, 8000);
      }

      setDepositStep({ step: "submitted", txHash });
      onSuccess();
    } catch (err) {
      setDepositStep({ step: "error", message: err instanceof Error ? err.message : "Transaction failed" });
    }
  }

  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl"
      >
        <span>{zh ? "或使用 MetaMask / Trust Wallet 直接发送" : "Or send directly with MetaMask / Trust Wallet"}</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
          {depositStep.step === "submitted" ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
              <p className="font-semibold text-green-900">{zh ? "✓ 交易已发送" : "✓ Transaction sent"}</p>
              <p className="text-sm text-green-700">{zh ? "链上确认后自动到账（通常1分钟内）。" : "Credited automatically once confirmed (usually within 1 minute)."}</p>
              <a href={`https://bscscan.com/tx/${depositStep.txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-green-700 underline break-all">
                {depositStep.txHash}
              </a>
            </div>
          ) : (
            <>
              {/* Connect step */}
              <div className={`rounded-lg border p-4 space-y-2 ${wallet.status === "connected" ? "border-green-200 bg-green-50" : "border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{zh ? "1. 连接钱包" : "1. Connect wallet"}</p>
                  {wallet.status === "connected" ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">{shortenAddress(wallet.address)}</span>
                  ) : (
                    <Button size="sm" onClick={connectWallet} disabled={wallet.status === "connecting"}>
                      {wallet.status === "connecting" ? (zh ? "连接中…" : "Connecting…") : (zh ? "连接" : "Connect")}
                    </Button>
                  )}
                </div>
                {wallet.status === "error" && <p className="text-xs text-red-600">{wallet.message}</p>}
              </div>

              {/* Amount + send step */}
              <div className={`rounded-lg border p-4 space-y-3 ${wallet.status !== "connected" ? "opacity-40 pointer-events-none" : "border-slate-200"}`}>
                <p className="text-sm font-medium">{zh ? "2. 输入金额" : "2. Enter amount"}</p>
                {balance != null && (
                  <p className="text-xs text-slate-500">
                    {zh ? `钱包余额：${balance} USDT` : `Balance: ${balance} USDT`}
                    <button type="button" className="ml-2 text-blue-600 underline text-xs" onClick={() => setAmount(balance)}>{zh ? "全部" : "Max"}</button>
                  </p>
                )}
                <div className="flex gap-3">
                  <input type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900" />
                  <span className="self-center text-sm font-semibold text-slate-600">USDT</span>
                </div>
                {depositStep.step === "error" && <p className="text-xs text-red-600">{depositStep.message}</p>}
                <Button onClick={sendDeposit} disabled={!amount || parseFloat(amount) <= 0 || depositStep.step === "sending" || !platformAddress} className="w-full">
                  {depositStep.step === "sending" ? (zh ? "等待确认…" : "Waiting for confirmation…") : (zh ? "发送存款" : `Deposit ${amount ? `${amount} USDT` : "USDT"}`)}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deposit history
// ---------------------------------------------------------------------------

function DepositHistory({ deposits, t, locale }: { deposits: DepositRow[]; t: T["deposit"]; locale: Locale }) {
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
                {d.amountReceived != null ? d.amountReceived : d.amountExpected != null ? `~${d.amountExpected}` : "—"}
              </td>
              <td className="px-3 py-3 sm:px-4"><StatusBadge status={d.status} t={t} /></td>
              <td className="hidden px-3 py-3 text-slate-500 md:table-cell sm:px-4">
                {d.txHash ? (
                  <a href={`https://bscscan.com/tx/${d.txHash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-blue-600 underline">
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
  const zh = locale === "zh";

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
        <p className="page-subtitle">
          {zh
            ? "将 USDT 发送到您的专属地址，余额自动到账。"
            : "Send USDT to your personal address and your balance updates automatically."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{zh ? "充值地址" : "Deposit address"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UniqueAddressDeposit locale={locale} />
          <MetaMaskDeposit locale={locale} onSuccess={loadDeposits} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">{t.your_requests}</h2>
        <Card>
          {loading ? (
            <CardContent className="py-6 text-center text-sm text-slate-400">{t.loading}</CardContent>
          ) : (
            <DepositHistory deposits={deposits} t={t} locale={locale} />
          )}
        </Card>
      </div>
    </div>
  );
}
