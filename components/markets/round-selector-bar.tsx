"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { RoundSlot } from "@/lib/services/round-history";

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function useCountdown(targetIso: string): string {
  // Start null to avoid SSR/client mismatch — populated in useEffect
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1_000));
      return `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
    };
    setLabel(calc());
    const id = setInterval(() => setLabel(calc()), 1_000);
    return () => clearInterval(id);
  }, [targetIso]);
  return label ?? "--:--";
}

function ResultDot({ result }: { result: RoundSlot["roundResult"] }) {
  const color =
    result === "up"   ? "var(--teal)"  :
    result === "down" ? "var(--rose)"  : "var(--text-dim)";
  return (
    <span
      style={{
        display: "inline-block",
        width: 8, height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

function SettledPill({ slot, isCurrent }: { slot: RoundSlot; isCurrent: boolean }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/markets/${slot.slug}`)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        borderRadius: 12,
        padding: "8px 12px",
        textAlign: "center",
        transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
        border: "none",
        cursor: "pointer",
        flexShrink: 0,
        backgroundColor: isCurrent ? "var(--bg-elevated)" : "transparent",
        color: isCurrent ? "var(--text-primary)" : "var(--text-dim)",
      }}
    >
      <ResultDot result={slot.roundResult} />
      <span style={{ fontSize: 10, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {formatTime(slot.closeAt)}
      </span>
    </button>
  );
}

function LivePill({ slot, isCurrent }: { slot: RoundSlot; isCurrent: boolean }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/markets/${slot.slug}`)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        borderRadius: 12,
        padding: "8px 12px",
        textAlign: "center",
        transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
        border: "1px solid rgba(239,68,68,0.3)",
        cursor: "pointer",
        flexShrink: 0,
        backgroundColor: isCurrent ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)",
        boxShadow: isCurrent ? "0 2px 8px rgba(239,68,68,0.2)" : "none",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            width: 8, height: 8,
            borderRadius: "50%",
            backgroundColor: "#ef4444",
            animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
          }}
        />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#ef4444" }}>
          Live
        </span>
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
        {formatTime(slot.closeAt)}
      </span>
    </button>
  );
}

function UpcomingPill({ slot, isCurrent }: { slot: RoundSlot; isCurrent: boolean }) {
  const router = useRouter();
  const countdown = useCountdown(slot.openAt);
  const isClickable = Boolean(slot.id);

  return (
    <button
      onClick={() => isClickable && router.push(`/markets/${slot.slug}`)}
      disabled={!isClickable}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        borderRadius: 12,
        padding: "8px 12px",
        textAlign: "center",
        transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
        border: isCurrent
          ? "1px solid var(--border-gold)"
          : "1px dashed var(--border-subtle)",
        cursor: isClickable ? "pointer" : "default",
        flexShrink: 0,
        backgroundColor: isCurrent ? "var(--gold-dim)" : "transparent",
        opacity: !isCurrent && !isClickable ? 0.5 : 1,
        boxShadow: isCurrent ? "0 2px 8px var(--gold-glow)" : "none",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 4, color: isCurrent ? "var(--gold)" : "var(--text-dim)" }}>
        <Clock style={{ width: 12, height: 12 }} />
        <span style={{ fontSize: 10, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{countdown}</span>
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: isCurrent ? "var(--gold)" : "var(--text-dim)" }}>
        {formatTime(slot.closeAt)}
      </span>
    </button>
  );
}

type Props = {
  past: RoundSlot[];
  current: RoundSlot | null;
  upcoming: RoundSlot[];
  /** Extra upcoming slots derived from timing (no DB row yet) */
  calculatedSlots?: { openAt: string; closeAt: string }[];
  currentSlug: string;
};

export function RoundSelectorBar({ past, current, upcoming, calculatedSlots = [], currentSlug }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Auto-scroll to center the active pill on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector("[data-active]") as HTMLElement | null;
    if (active) {
      el.scrollLeft = active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2;
    }
  }, [pathname]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" });
  };

  const allSlots = past.length + (current ? 1 : 0) + upcoming.length + calculatedSlots.length;
  if (allSlots === 0) return null;

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
      {/* Left arrow */}
      <button
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        style={{
          flexShrink: 0,
          borderRadius: "50%",
          border: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
          padding: 4,
          cursor: "pointer",
          color: "var(--text-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
          boxShadow: "0 1px 3px var(--shadow-drawer)",
        }}
      >
        <ChevronLeft style={{ width: 14, height: 14 }} />
      </button>

      {/* Scrollable pill row */}
      <div
        ref={scrollRef}
        style={{ display: "flex", gap: 8, overflowX: "auto", scrollBehavior: "smooth", scrollbarWidth: "none" }}
      >
        {/* Past rounds */}
        {past.map((slot) => (
          <div key={slot.id} data-active={slot.slug === currentSlug ? "" : undefined}>
            <SettledPill slot={slot} isCurrent={slot.slug === currentSlug} />
          </div>
        ))}

        {/* Current live round */}
        {current && (
          <div data-active={current.slug === currentSlug ? "" : undefined}>
            {current.phase === "live" ? (
              <LivePill slot={current} isCurrent={current.slug === currentSlug} />
            ) : (
              <UpcomingPill slot={current} isCurrent={current.slug === currentSlug} />
            )}
          </div>
        )}

        {/* Pre-created upcoming rounds */}
        {upcoming.map((slot) => (
          <UpcomingPill key={slot.id} slot={slot} isCurrent={slot.slug === currentSlug} />
        ))}

        {/* Pure calculated future slots (no DB row yet) */}
        {calculatedSlots.map((s) => (
          <UpcomingPill
            key={s.closeAt}
            slot={{ id: "", slug: "", closeAt: s.closeAt, openAt: s.openAt, roundResult: null, phase: "upcoming" }}
            isCurrent={false}
          />
        ))}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        style={{
          flexShrink: 0,
          borderRadius: "50%",
          border: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
          padding: 4,
          cursor: "pointer",
          color: "var(--text-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
          boxShadow: "0 1px 3px var(--shadow-drawer)",
        }}
      >
        <ChevronRight style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
