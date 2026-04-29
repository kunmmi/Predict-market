"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  closeAt: string;
  t: { countdown_closes_in: string; countdown_expired: string };
  onExpired?: () => void;
};

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MarketCountdown({ closeAt, t, onExpired }: Props) {
  const closeAtMs = new Date(closeAt).getTime();
  const [remaining, setRemaining] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;

    const tick = () => {
      const nextRemaining = closeAtMs - Date.now();
      setRemaining(nextRemaining);

      if (nextRemaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpired?.();
      }
    };

    tick();
    const intervalId = setInterval(tick, 1000);

    return () => clearInterval(intervalId);
  }, [closeAtMs, onExpired]);

  if (remaining == null) {
    return <span className="font-medium text-slate-600">{t.countdown_closes_in} --:--</span>;
  }

  if (remaining <= 0) {
    return <span className="font-medium text-slate-500">{t.countdown_expired}</span>;
  }

  return (
    <span className={remaining <= 60_000 ? "animate-pulse font-medium text-red-600" : "font-medium text-slate-600"}>
      {t.countdown_closes_in} {formatRemaining(remaining)}
    </span>
  );
}
