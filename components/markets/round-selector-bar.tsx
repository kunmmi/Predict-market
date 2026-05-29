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
  const calc = () => {
    const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1_000));
    return `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
  };
  const [label, setLabel] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setLabel(calc()), 1_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);
  return label;
}

function ResultDot({ result }: { result: RoundSlot["roundResult"] }) {
  const color =
    result === "up"   ? "bg-green-500" :
    result === "down" ? "bg-red-500"   : "bg-slate-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function SettledPill({ slot, isCurrent }: { slot: RoundSlot; isCurrent: boolean }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/markets/${slot.slug}`)}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-center transition-all ${
        isCurrent
          ? "bg-slate-200 text-slate-900"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      <ResultDot result={slot.roundResult} />
      <span className="text-[10px] font-semibold tabular-nums">{formatTime(slot.closeAt)}</span>
    </button>
  );
}

function LivePill({ slot, isCurrent }: { slot: RoundSlot; isCurrent: boolean }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/markets/${slot.slug}`)}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-center shadow-md transition-all ${
        isCurrent
          ? "bg-slate-900"
          : "bg-slate-700 hover:bg-slate-800"
      }`}
    >
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Live</span>
      </span>
      <span className="text-[10px] font-semibold tabular-nums text-slate-300">
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
      className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center transition-all ${
        isCurrent
          ? "border-yellow-400 bg-yellow-100 shadow-md"
          : isClickable
            ? "border-dashed border-slate-200 cursor-pointer hover:border-yellow-300 hover:bg-yellow-50"
            : "border-dashed border-slate-200 cursor-default opacity-50"
      }`}
    >
      <span className={`flex items-center gap-1 ${isCurrent ? "text-yellow-700" : "text-slate-400"}`}>
        <Clock className="h-3 w-3" />
        <span className="text-[10px] font-semibold tabular-nums">{countdown}</span>
      </span>
      <span className={`text-[10px] font-semibold tabular-nums ${isCurrent ? "text-yellow-800" : "text-slate-500"}`}>
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
    <div className="relative flex items-center gap-1">
      {/* Left arrow */}
      <button
        onClick={() => scroll("left")}
        className="z-10 shrink-0 rounded-full border border-slate-200 bg-white p-1 shadow-sm hover:bg-slate-50"
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
      </button>

      {/* Scrollable pill row */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
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
        className="z-10 shrink-0 rounded-full border border-slate-200 bg-white p-1 shadow-sm hover:bg-slate-50"
        aria-label="Scroll right"
      >
        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
      </button>
    </div>
  );
}
