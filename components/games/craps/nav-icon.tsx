"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";

// [col, row] in a 3×3 grid, 0-indexed
const DOTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function TinyDie({ face, size }: { face: number; size: number }) {
  const pad = size * 0.18;
  const dotR = size * 0.105;
  const cell = (size - pad * 2) / 3;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: "rgba(255,255,255,0.93)",
        border: "1.2px solid currentColor",
        position: "relative",
        flexShrink: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,0.28)",
        opacity: 0.9,
      }}
    >
      {(DOTS[face] ?? []).map(([col, row], i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            width: dotR * 2,
            height: dotR * 2,
            borderRadius: "50%",
            background: "currentColor",
            left: pad + col * cell + cell / 2 - dotR,
            top: pad + row * cell + cell / 2 - dotR,
          }}
        />
      ))}
    </div>
  );
}

// Accepts the same `style` prop lucide icons receive (width/height come from the nav)
export function GamesNavIcon({ style }: { style?: CSSProperties }) {
  const iconSize = typeof style?.width === "number" ? style.width : 13;
  const dieSize = Math.round(iconSize * 0.82);
  const gap = Math.max(2, Math.round(iconSize * 0.18));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap,
        flexShrink: 0,
        // override height to match what the nav expects
        height: iconSize,
      }}
    >
      {/* Die showing 5 — bobs upward */}
      <motion.div
        animate={{ y: [-2.5, 2, -2.5], rotate: [-6, 4, -6] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <TinyDie face={5} size={dieSize} />
      </motion.div>

      {/* Die showing 2 — bobs downward (5+2=7, the key craps number) */}
      <motion.div
        animate={{ y: [2, -2.5, 2], rotate: [5, -6, 5] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
      >
        <TinyDie face={2} size={dieSize} />
      </motion.div>
    </div>
  );
}
