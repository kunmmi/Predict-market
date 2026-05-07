"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  enabled: boolean;
  intervalMs?: number;
};

export function MarketsAutoRefresh({ enabled, intervalMs = 15_000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    // Immediately flush the router cache on mount so users always land on fresh data
    router.refresh();

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    };

    const intervalId = window.setInterval(refreshIfVisible, intervalMs);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
