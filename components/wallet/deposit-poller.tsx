"use client";

import { useRouter } from "next/navigation";
import { useVisibilityPoll } from "@/lib/hooks/use-visibility-poll";

/**
 * Invisible background component: polls /api/wallet/check-deposits every 30s
 * and calls router.refresh() if a new deposit is credited — so any server
 * component on the page (wallet balance, transaction list, etc.) re-renders
 * with fresh data without the user having to navigate to /wallet/deposit.
 */
export function DepositPoller() {
  const router = useRouter();

  useVisibilityPoll(async () => {
    try {
      const res = await fetch("/api/wallet/check-deposits", { method: "POST" });
      if (!res.ok) return;
      const json = (await res.json()) as { credited?: number };
      if (json.credited && json.credited > 0) {
        router.refresh();
      }
    } catch {
      // best-effort — background sweep is the safety net
    }
  }, 30_000);

  return null;
}
