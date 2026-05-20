"use client";

import { useEffect, useRef } from "react";

/**
 * Run `callback` immediately, then every `intervalMs` — but only while the
 * tab is visible. Pauses when the tab is hidden/backgrounded and resumes
 * (with an immediate call) when the user comes back.
 *
 * This dramatically reduces API call volume since users often have many
 * tabs open. Avoids burning Vercel function invocations + Supabase reads
 * for tabs nobody's looking at.
 *
 * Pass `enabled=false` to disable polling entirely.
 */
export function useVisibilityPoll(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean = true,
) {
  // Stable ref so the effect doesn't restart when caller passes a fresh fn each render
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      void callbackRef.current();
    };

    const start = () => {
      if (timer != null) return;
      // Fire immediately when becoming visible so users see fresh data
      tick();
      timer = setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      // Don't fire immediately on mount — caller usually does an initial load
      timer = setInterval(tick, intervalMs);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
