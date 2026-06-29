"use client";

import { useEffect, useState } from "react";

const DOT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  1: [{ top: "50%", left: "50%" }],
  2: [
    { top: "25%", left: "25%" },
    { top: "75%", left: "75%" },
  ],
  3: [
    { top: "25%", left: "25%" },
    { top: "50%", left: "50%" },
    { top: "75%", left: "75%" },
  ],
  4: [
    { top: "25%", left: "25%" },
    { top: "25%", left: "75%" },
    { top: "75%", left: "25%" },
    { top: "75%", left: "75%" },
  ],
  5: [
    { top: "25%", left: "25%" },
    { top: "25%", left: "75%" },
    { top: "50%", left: "50%" },
    { top: "75%", left: "25%" },
    { top: "75%", left: "75%" },
  ],
  6: [
    { top: "25%", left: "25%" },
    { top: "25%", left: "75%" },
    { top: "50%", left: "25%" },
    { top: "50%", left: "75%" },
    { top: "75%", left: "25%" },
    { top: "75%", left: "75%" },
  ],
};

interface DieProps {
  value: number;
  rolling?: boolean;
  size?: number;
}

export function Die({ value, rolling = false, size = 72 }: DieProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (!rolling) {
      setDisplayValue(value);
      return;
    }
    let ticks = 0;
    const interval = setInterval(() => {
      setDisplayValue(Math.ceil(Math.random() * 6));
      ticks++;
      if (ticks > 10) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, [rolling, value]);

  const dots = DOT_POSITIONS[displayValue] ?? [];

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        borderRadius: size * 0.16,
        background: "linear-gradient(145deg, #ffffff 0%, #e8e8e8 100%)",
        boxShadow: rolling
          ? "0 0 20px var(--gold-glow), 0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.8)"
          : "0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8)",
        transition: "box-shadow 300ms ease",
        animation: rolling ? "dieShake 0.12s infinite alternate" : "none",
        flexShrink: 0,
      }}
    >
      {dots.map((pos, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            width: size * 0.16,
            height: size * 0.16,
            borderRadius: "50%",
            background: "#1a1a1a",
            transform: "translate(-50%, -50%)",
            top: pos.top,
            left: pos.left,
            transition: "none",
          }}
        />
      ))}
    </div>
  );
}
