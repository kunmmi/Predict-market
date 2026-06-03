"use client";

import { useEffect } from "react";

/**
 * Invisible component that redirects to the base slug the moment an upcoming
 * round's open time arrives. This handles two cases:
 *   1. The user is watching the countdown — it smoothly transitions them to
 *      the now-live round at the base slug when the timer hits zero.
 *   2. The user arrives after openAt has already passed — redirected immediately.
 *
 * Uses window.location.replace (not router.replace) so the redirect bypasses
 * Next.js router cache and always fetches fresh server data — otherwise the
 * user would land on a stale cached page showing the old round with the wrong
 * marketId, causing their position to not appear.
 */
export function UpcomingRoundRedirector({
  openAt,
  baseSlug,
}: {
  openAt: string;
  baseSlug: string;
}) {
  useEffect(() => {
    const openMs = new Date(openAt).getTime();
    const delay = openMs - Date.now();

    if (delay <= 0) {
      // The open time has already passed but the settlement cron may not have
      // promoted this round to the base slug yet. Redirecting immediately would
      // land the user on the OLD round at the base slug, which looks like
      // "jumping back". Stay on this page — the 404 fallback handles the case
      // where someone refreshes after promotion has completed.
      return;
    }

    const id = setTimeout(() => {
      // window.location.replace: replaces history entry (no back-button bloat)
      // AND forces a full page reload — bypassing Next.js router cache so the
      // new round's server data is always fetched fresh.
      window.location.replace(`/markets/${baseSlug}`);
    }, delay);

    return () => clearTimeout(id);
  }, [openAt, baseSlug]);

  return null;
}
