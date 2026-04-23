"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import QRCode from "react-qr-code";

import { depositCreateSchema } from "@/lib/validations/deposit";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DepositStatus } from "@/types/enums";
import type { Locale, T } from "@/lib/i18n/translations";

type FormValues = z.infer<typeof depositCreateSchema>;
const ASSETS = ["USDT"] as const;

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

function VerifyPaymentCard({ deposit, onVerified, locale }: {
  deposit: DepositRow;
  onVerified: () => void;
  locale: Locale;
}) {
  const [state, setState] = React.useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleVerify() {
    setState("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/deposits/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deposit_id: deposit.id }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (res.ok && json?.success) {
        onVerified();
      } else {
        setErrorMsg(json?.message ?? "Verification failed. Please try again.");
        setState("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-lg font-bold">
          ✓
        </div>
        <div>
          <p className="font-semibold text-green-900">
            {locale === "zh" ? "已发送资金？立即验证确认到账" : "Sent your funds? Verify now to credit your wallet instantly"}
          </p>
          <p className="mt-1 text-sm text-green-700">
            {locale === "zh"
              ? `您的 ${deposit.assetSymbol} 充值正在等待确认。点击下方按钮，我们将立即在链上核实并为您到账。`
              : `Your ${deposit.assetSymbol} deposit is waiting for confirmation. Click the button below and we'll verify it on-chain and credit your wallet immediately.`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleVerify}
        disabled={state === "loading"}
        className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
      >
        {state === "loading"
          ? (locale === "zh" ? "验证中…" : "Verifying your payment…")
          : (locale === "zh" ? "✓ 验证我的付款" : "✓ Verify my payment")}
      </button>
      {state === "error" && errorMsg && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
      )}
    </div>
  );
}

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

function AddressCard({
  address,
  asset,
  networkLabel,
  t,
  locale,
}: {
  address: string;
  asset: string;
  networkLabel: string;
  t: T["deposit"];
  locale: Locale;
}) {
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-blue-800">
            {locale === "zh" ? `发送 ${asset} 到此地址` : `Send ${asset} to this address`}
          </p>
          <p className="text-xs text-blue-600">{networkLabel}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <p className="select-all break-all rounded-md bg-white border border-blue-100 px-3 py-2 font-mono text-xs text-slate-800">
        {address}
      </p>
      <div className="flex justify-center rounded-md bg-white p-3">
        <QRCode value={address} size={148} />
      </div>
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
        {t.auto_confirmed}
      </div>
    </div>
  );
}

type AddressConfig = Record<string, { address: string | null; networkLabel: string }>;

type NetworkOption = { label: string; value: string; sub: string };
const NETWORK_OPTIONS: Record<string, NetworkOption[]> = {
  // Only BNB Smart Chain (BEP-20) is supported for now.
  // Other chains will be added as deposit volume grows.
  USDT: [{ label: "BSC", value: "BNB Smart Chain (BEP-20)", sub: "BEP-20" }],
};

function NetworkPicker({
  asset,
  value,
  onChange,
}: {
  asset: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = NETWORK_OPTIONS[asset] ?? [];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              isSelected
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            <span>{opt.label}</span>
            <span className={`text-[10px] font-normal ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
              {opt.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DepositForm({ onSuccess, t, locale }: { onSuccess: (hadAddress: boolean) => void; t: T["deposit"]; locale: Locale }) {
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [hadAddress, setHadAddress] = React.useState(false);
  const [addressConfig, setAddressConfig] = React.useState<AddressConfig | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(depositCreateSchema),
    defaultValues: {
      asset_symbol: "USDT",
      network_name: "BNB Smart Chain (BEP-20)",
      amount_expected: "",
      tx_hash: "",
      deposit_address: "",
    },
  });

  const selectedAsset = form.watch("asset_symbol");
  const selectedNetwork = form.watch("network_name");

  // When asset changes, auto-select first network for that asset
  React.useEffect(() => {
    const first = NETWORK_OPTIONS[selectedAsset]?.[0]?.value ?? "";
    form.setValue("network_name", first);
  }, [selectedAsset, form]);

  React.useEffect(() => {
    fetch("/api/config/deposit-addresses")
      .then((r) => r.json())
      .then((json: { addresses?: AddressConfig }) => setAddressConfig(json.addresses ?? null))
      .catch(() => {});
  }, []);

  const platformAddress = addressConfig?.[selectedAsset]?.address ?? null;
  const networkLabel = addressConfig?.[selectedAsset]?.networkLabel ?? null;

  async function onSubmit(values: FormValues) {
    setErrorMessage(null);
    const res = await fetch("/api/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (!res.ok || !json?.success) {
      setErrorMessage(json?.message ?? "Failed to submit deposit request.");
      return;
    }
    setHadAddress(!!platformAddress);
    setSubmitted(true);
    onSuccess(!!platformAddress);
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-medium">{t.success_title}</p>
        <p className="mt-1 text-green-700">
          {hadAddress ? t.success_auto : t.success_manual}
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      {/* Asset selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">{t.label_asset}</label>
        <div className="flex flex-wrap gap-2">
          {ASSETS.map((asset) => {
            const isSelected = selectedAsset === asset;
            return (
              <button
                key={asset}
                type="button"
                onClick={() => form.setValue("asset_symbol", asset)}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {asset}
              </button>
            );
          })}
        </div>
      </div>

      {/* Network picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">{t.label_network}</label>
        <NetworkPicker
          asset={selectedAsset}
          value={selectedNetwork ?? ""}
          onChange={(v) => form.setValue("network_name", v)}
        />
      </div>

      {/* Platform address + QR */}
      {addressConfig === null ? (
        <p className="text-xs text-slate-400">{t.loading_address}</p>
      ) : platformAddress ? (
        <AddressCard
          address={platformAddress}
          asset={selectedAsset}
          networkLabel={networkLabel ?? selectedNetwork ?? ""}
          t={t}
          locale={locale}
        />
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {locale === "zh"
            ? `${selectedAsset} 的充值地址尚未配置，请提交请求后联系客服获取收款地址。`
            : `Deposit address not yet configured for ${selectedAsset}. Submit your request and contact support for the receiving address.`}
        </div>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="amount_expected">
          {t.label_amount}{" "}
          <span className="font-normal text-slate-400">{t.label_optional}</span>
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="amount_expected"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            className="max-w-[200px]"
            {...form.register("amount_expected")}
          />
          <span className="text-sm text-slate-500">{selectedAsset}</span>
        </div>
      </div>

      {/* TX hash */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="tx_hash">
          {t.label_tx_hash}{" "}
          <span className="font-normal text-slate-400">
            {platformAddress ? t.tx_hash_hint_with_address : t.tx_hash_hint_without_address}
          </span>
        </label>
        <Input
          id="tx_hash"
          type="text"
          placeholder="0x..."
          className="font-mono text-sm"
          {...form.register("tx_hash")}
        />
      </div>

      {/* How it works */}
      <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
        <p className="font-medium text-slate-700">{t.how_it_works}</p>
        {platformAddress ? (
          <ol className="list-decimal list-inside space-y-1 mt-1">
            <li>{locale === "zh" ? `将 ${selectedAsset} 发送到上方地址。` : `Send ${selectedAsset} to the address shown above.`}</li>
            <li>{locale === "zh" ? "在上方填写交易哈希（推荐）。" : "Paste your transaction hash in the field above (recommended)."}</li>
            <li>{locale === "zh" ? "提交 — 链上确认后自动到账。" : "Submit — your wallet is credited automatically once confirmed on-chain."}</li>
          </ol>
        ) : (
          <ol className="list-decimal list-inside space-y-1 mt-1">
            <li>{locale === "zh" ? "提交表单 — 充值请求立即创建。" : "Submit this form — a deposit request is created immediately."}</li>
            <li>{locale === "zh" ? "您将通过客服或推广者获得收款地址。" : "You will receive the deposit address from support or your promoter."}</li>
            <li>{locale === "zh" ? "发送资金并填写交易哈希（如已有）。" : "Send your funds and add the transaction hash to your request if you have it."}</li>
            <li>{locale === "zh" ? "管理员审核并在链上确认后为您到账。" : "An admin reviews and credits your wallet once confirmed on-chain."}</li>
          </ol>
        )}
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full sm:w-auto"
      >
        {form.formState.isSubmitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}

function DepositHistory({ deposits, t, onRefresh, locale }: { deposits: DepositRow[]; t: T["deposit"]; onRefresh: () => void; locale: Locale }) {
  if (deposits.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{t.no_requests}</p>;
  }

  // Pending deposits with a tx hash — show prominent verify cards
  const verifiable = deposits.filter((d) => d.status === "pending" && d.txHash);

  return (
    <div className="space-y-4">
      {/* Prominent verify cards — one per pending deposit with tx hash */}
      {verifiable.map((d) => (
        <div key={d.id} className="px-4 pt-4">
          <VerifyPaymentCard deposit={d} onVerified={onRefresh} locale={locale} />
        </div>
      ))}

      {/* History table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="hidden px-3 py-3 sm:table-cell sm:px-4">{t.col_date}</th>
              <th className="px-3 py-3 sm:px-4">{t.col_asset}</th>
              <th className="hidden px-3 py-3 sm:table-cell sm:px-4">{t.col_network}</th>
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
                <td className="hidden px-3 py-3 text-slate-500 sm:table-cell sm:px-4">{d.networkName ?? "—"}</td>
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
                <td className="hidden px-3 py-3 text-slate-500 md:table-cell sm:px-4">{d.adminNotes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DepositPageClient({ t, locale }: { t: T["deposit"]; locale: Locale }) {
  const router = useRouter();
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

  React.useEffect(() => {
    void loadDeposits();
  }, []);

  function handleSuccess(_hadAddress: boolean) {
    void loadDeposits();
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-subtitle">{t.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.new_request}</CardTitle>
        </CardHeader>
        <CardContent>
          <DepositForm onSuccess={handleSuccess} t={t} locale={locale} />
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
            <DepositHistory deposits={deposits} t={t} onRefresh={loadDeposits} locale={locale} />
          )}
        </Card>
      </div>
    </div>
  );
}
