"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Invisible component that redirects to the base slug the moment an upcoming
 * round's open time arrives. This handles two cases:
 *   1. The user is watching the countdown — it smoothly transitions them to
 *      the now-live round at the base slug when the timer hits zero.
 *   2. The user arrives after openAt has already passed — redirected immediately.
 *
 * Uses router.replace so the upcoming-round URL doesn't stay in history.
 */
export function UpcomingRoundRedirector({
  openAt,
  baseSlug,
}: {
  openAt: string;
  baseSlug: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const openMs = new Date(openAt).getTime();
    const delay = openMs - Date.now();

    if (delay <= 0) {
      // Already open — redirect straight away
      router.replace(`/markets/${baseSlug}`);
      return;
    }

    const id = setTimeout(() => {
      router.replace(`/markets/${baseSlug}`);
    }, delay);

    return () => clearTimeout(id);
  }, [openAt, baseSlug, router]);

  return null;
}
