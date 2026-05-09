"use client";

import * as React from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DepositStatus } from "@/types/enums";
import type { Locale, T } from "@/lib/i18n/translations";

// USDT BEP-20 contract on BSC mainnet
const USDT_BSC_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const BSC_CHAIN_ID = "0x38"; // 56 in hex
const BSC_CHAIN_ID_DEC = 56;

// Minimal ERC-20 ABI for transfer
const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
];

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

type WalletState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; address: string }
  | { status: "error"; message: string };

type DepositStep =
  | { step: "connect" }
  | { step: "amount" }
  | { step: "sending" }
  | { step: "submitted"; txHash: string }
  | { step: "error"; message: string };

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function WalletConnectDeposit({ t, locale, onSuccess }: {
  t: T["deposit"];
  locale: Locale;
  onSuccess: () => void;
}) {
  const [wallet, setWallet] = React.useState<WalletState>({ status: "idle" });
  const [depositStep, setDepositStep] = React.useState<DepositStep>({ step: "connect" });
  const [amount, setAmount] = React.useState("");
  const [platformAddress, setPlatformAddress] = React.useState<string | null>(null);
  const [balance, setBalance] = React.useState<string | null>(null);

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
      setWallet({ status: "error", message: locale === "zh" ? "未检测到钱包。请使用 Trust Wallet 或 MetaMask 浏览器打开此页面。" : "No wallet detected. Please open this page in Trust Wallet or install MetaMask." });
      return;
    }

    setWallet({ status: "connecting" });

    try {
      // Request accounts
      const accounts = await eth.request({ method: "eth_requestAccounts" }) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No account returned");

      // Switch to BSC if needed
      const chainId = await eth.request({ method: "eth_chainId" }) as string;
      if (chainId !== BSC_CHAIN_ID) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BSC_CHAIN_ID }],
          });
        } catch {
          // Add BSC chain if not present
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
      setDepositStep({ step: "amount" });

      // Fetch USDT balance
      fetchBalance(address, eth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setWallet({ status: "error", message: msg });
    }
  }

  async function fetchBalance(address: string, eth: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }) {
    try {
      // balanceOf(address) call
      const data = "0x70a08231" + address.slice(2).padStart(64, "0");
      const result = await eth.request({
        method: "eth_call",
        params: [{ to: USDT_BSC_ADDRESS, data }, "latest"],
      }) as string;
      const raw = BigInt(result);
      const formatted = (Number(raw) / 1e18).toFixed(2);
      setBalance(formatted);
    } catch {
      // balance fetch is non-critical
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
      // Encode transfer(address, uint256) call
      // transfer selector: 0xa9059cbb
      const toAddr = platformAddress.slice(2).padStart(64, "0");
      // USDT on BSC has 18 decimals
      const amountWei = BigInt(Math.round(amountNum * 1e18));
      const amountHex = amountWei.toString(16).padStart(64, "0");
      const data = "0xa9059cbb" + toAddr + amountHex;

      const txHash = await eth.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet.address,
          to: USDT_BSC_ADDRESS,
          data,
          chainId: BSC_CHAIN_ID_DEC,
        }],
      }) as string;

      // Submit deposit to backend
      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_symbol: "USDT",
          network_name: "BNB Smart Chain (BEP-20)",
          amount_expected: amount,
          tx_hash: txHash,
          sender_wallet: wallet.address,
        }),
      });

      const json = (await res.json().catch(() => null)) as { success?: boolean; depositId?: string; message?: string } | null;

      if (!res.ok || !json?.success) {
        throw new Error(json?.message ?? "Failed to record deposit");
      }

      // Auto-verify after a short delay for confirmation
      if (json.depositId) {
        setTimeout(async () => {
          await fetch("/api/deposits/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deposit_id: json.depositId }),
          });
          onSuccess();
        }, 8000);
      }

      setDepositStep({ step: "submitted", txHash });
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setDepositStep({ step: "error", message: msg });
    }
  }

  if (depositStep.step === "submitted") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-2">
          <p className="font-semibold text-green-900">
            {locale === "zh" ? "✓ 交易已发送" : "✓ Transaction sent"}
          </p>
          <p className="text-sm text-green-700">
            {locale === "zh"
              ? "您的存款正在链上确认，确认后将自动到账（通常在1分钟内）。"
              : "Your deposit is confirming on-chain and will be credited automatically (usually within 1 minute)."}
          </p>
          <a
            href={`https://bscscan.com/tx/${depositStep.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-mono text-green-700 underline break-all"
          >
            {depositStep.txHash}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step 1: Connect wallet */}
      <div className={`rounded-xl border p-5 space-y-3 ${wallet.status === "connected" ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-900">
              {locale === "zh" ? "1. 连接钱包" : "1. Connect wallet"}
            </p>
            {wallet.status === "connected" && (
              <p className="mt-0.5 text-sm text-green-700 font-mono">{shortenAddress(wallet.address)}</p>
            )}
          </div>
          {wallet.status === "connected" ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              {locale === "zh" ? "已连接" : "Connected"}
            </span>
          ) : (
            <Button
              onClick={connectWallet}
              disabled={wallet.status === "connecting"}
              size="sm"
            >
              {wallet.status === "connecting"
                ? (locale === "zh" ? "连接中…" : "Connecting…")
                : (locale === "zh" ? "连接钱包" : "Connect wallet")}
            </Button>
          )}
        </div>
        {wallet.status === "error" && (
          <p className="text-sm text-red-600">{wallet.message}</p>
        )}
        {wallet.status === "idle" && (
          <p className="text-xs text-slate-500">
            {locale === "zh"
              ? "支持 Trust Wallet、MetaMask 及所有 WalletConnect 兼容钱包。"
              : "Works with Trust Wallet, MetaMask, and all WalletConnect-compatible wallets."}
          </p>
        )}
      </div>

      {/* Step 2: Amount + send */}
      <div className={`rounded-xl border p-5 space-y-4 ${wallet.status !== "connected" ? "opacity-50 pointer-events-none" : "border-slate-200 bg-white"}`}>
        <p className="font-semibold text-slate-900">
          {locale === "zh" ? "2. 输入金额并存款" : "2. Enter amount and deposit"}
        </p>

        {balance != null && (
          <p className="text-xs text-slate-500">
            {locale === "zh" ? `钱包余额：${balance} USDT` : `Wallet balance: ${balance} USDT`}
            <button
              type="button"
              className="ml-2 text-blue-600 underline"
              onClick={() => setAmount(balance)}
            >
              {locale === "zh" ? "全部" : "Max"}
            </button>
          </p>
        )}

        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <span className="text-sm font-semibold text-slate-600">USDT</span>
        </div>

        {!platformAddress && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
            {locale === "zh" ? "平台收款地址尚未配置，请联系管理员。" : "Platform deposit address not configured. Contact admin."}
          </p>
        )}

        {depositStep.step === "error" && (
          <p className="text-sm text-red-600">{depositStep.message}</p>
        )}

        <Button
          onClick={sendDeposit}
          disabled={
            wallet.status !== "connected" ||
            !platformAddress ||
            !amount ||
            parseFloat(amount) <= 0 ||
            depositStep.step === "sending"
          }
          className="w-full"
        >
          {depositStep.step === "sending"
            ? (locale === "zh" ? "等待钱包确认…" : "Waiting for wallet confirmation…")
            : (locale === "zh" ? "存款" : `Deposit ${amount ? `${amount} USDT` : "USDT"}`)}
        </Button>

        <p className="text-xs text-slate-400">
          {locale === "zh"
            ? "点击后，您的钱包将弹出确认请求。确认后交易将自动提交并到账。"
            : "Your wallet will prompt you to confirm. Once signed, the deposit is submitted and credited automatically."}
        </p>
      </div>
    </div>
  );
}

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
        <p className="page-subtitle">
          {locale === "zh"
            ? "通过 Trust Wallet 或 MetaMask 直接存入 USDT（BSC）。"
            : "Deposit USDT (BSC) directly from Trust Wallet or MetaMask."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.new_request}</CardTitle>
        </CardHeader>
        <CardContent>
          <WalletConnectDeposit t={t} locale={locale} onSuccess={loadDeposits} />
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
