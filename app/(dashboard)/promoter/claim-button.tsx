"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatDecimal } from "@/lib/helpers/format-decimal";

interface Props {
  pendingAmount: string;
  /** called after a successful claim so parent can trigger a server re-render */
  onClaimed?: (amount: number) => void;
}

export function ClaimCommissionsButton({ pendingAmount }: Props) {
  const router = useRouter();
  const pending = parseFloat(pendingAmount ?? "0");

  const [status, setStatus]   = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [claimed, setClaimed] = React.useState<number | null>(null);
  const [errMsg,  setErrMsg]  = React.useState<string | null>(null);

  async function handleClaim() {
    setStatus("loading");
    setErrMsg(null);
    try {
      const res  = await fetch("/api/promoters/claim-commissions", { method: "POST" });
      const json = await res.json() as { success?: boolean; claimed?: number; error?: string };
      if (!res.ok || !json.success) {
        setErrMsg(json.error ?? "Failed to claim commissions.");
        setStatus("error");
        return;
      }
      setClaimed(json.claimed ?? 0);
      setStatus("success");
      // Refresh the server component so the balance and commission totals update
      router.refresh();
    } catch {
      setErrMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        style={{
          borderRadius: 8,
          border: "1px solid rgba(13,184,145,0.3)",
          backgroundColor: "var(--teal-dim)",
          padding: "10px 14px",
          fontSize: "0.875rem",
          color: "var(--teal)",
        }}
      >
        <p className="font-semibold">Claimed successfully!</p>
        <p className="mt-0.5 text-xs" style={{ opacity: 0.85 }}>
          ${formatDecimal(String(claimed ?? 0), 2)} added to your wallet balance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClaim}
        disabled={status === "loading" || pending <= 0}
        className="w-full"
        style={pending > 0 ? {} : { opacity: 0.4 }}
      >
        {status === "loading"
          ? "Claiming…"
          : pending > 0
          ? `Claim $${formatDecimal(pendingAmount, 2)} to wallet`
          : "Nothing to claim"}
      </Button>
      {status === "error" && errMsg && (
        <p style={{ fontSize: "0.8125rem", color: "var(--rose)" }}>{errMsg}</p>
      )}
    </div>
  );
}
