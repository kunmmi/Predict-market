"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";

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
        background: "rgba(255,255,255,0.95)",
        border: "1.2px solid currentColor",
        position: "relative",
        flexShrink: 0,
        boxShadow: "0 1px 5px rgba(0,0,0,0.32)",
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

/**
 * Two dice that wind back, slam into each other mid-air, then ricochet apart.
 * Sits in the nav in place of a lucide icon — reads width/height from the
 * style prop the nav passes in so it scales correctly at all breakpoints.
 */
export function GamesNavIcon({ style }: { style?: CSSProperties }) {
  const iconSize = typeof style?.width === "number" ? style.width : 13;
  const dieSize = Math.round(iconSize * 0.84);
  const gap = Math.max(2, Math.round(iconSize * 0.22));

  // Distance each die travels to meet in the middle
  const smash = dieSize * 0.52 + gap / 2;
  // Ricochet overshoot after impact
  const ricochet = smash * 0.55;
  // How high they jump on the way in
  const jumpH = dieSize * 0.55;

  // Keyframe timeline (5 control points):
  //  0 → 1  wind-up (pull back slightly)
  //  1 → 2  SMASH (rush to center, jump upward)
  //  2 → 3  ricochet (fly past start point)
  //  3 → 4  settle back to rest
  const times = [0, 0.1, 0.38, 0.62, 1];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap,
        flexShrink: 0,
        height: iconSize,
      }}
    >
      {/* Left die — winds LEFT, smashes RIGHT */}
      <motion.div
        animate={{
          x:      [0, -smash * 0.35, smash,    -ricochet, 0],
          y:      [0,  0,            -jumpH,    -jumpH * 0.3, 0],
          rotate: [0, -8,             18,       -6,        0],
          scale:  [1,  1,             1.15,      0.88,      1],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          repeatDelay: 1.4,
          times,
          ease: ["easeIn", "easeIn", "easeOut", "easeOut"],
        }}
      >
        <TinyDie face={5} size={dieSize} />
      </motion.div>

      {/* Right die — winds RIGHT, smashes LEFT */}
      <motion.div
        animate={{
          x:      [0,  ricochet * 0.65, -smash,   ricochet, 0],
          y:      [0,  0,               -jumpH,   -jumpH * 0.3, 0],
          rotate: [0,  8,               -18,       6,        0],
          scale:  [1,  1,                1.15,     0.88,     1],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          repeatDelay: 1.4,
          times,
          ease: ["easeIn", "easeIn", "easeOut", "easeOut"],
        }}
      >
        <TinyDie face={2} size={dieSize} />
      </motion.div>
    </div>
  );
}
