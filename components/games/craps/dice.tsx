"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";

const SIZE = 84;
const HALF = SIZE / 2;
const DOT_SIZE = SIZE * 0.135;

// Rotation of the whole cube that brings each face value to face the viewer (+Z)
const FACE_ROT: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0,   ry: 0   }, // front face
  2: { rx: 0,   ry: -90 }, // right face
  3: { rx: -90, ry: 0   }, // top face
  4: { rx: 90,  ry: 0   }, // bottom face
  5: { rx: 0,   ry: 90  }, // left face
  6: { rx: 0,   ry: 180 }, // back face
};

// Dot positions [left%, top%] within each face
const FACE_DOTS: Record<number, [string, string][]> = {
  1: [["50%", "50%"]],
  2: [["31%", "31%"], ["69%", "69%"]],
  3: [["31%", "31%"], ["50%", "50%"], ["69%", "69%"]],
  4: [["31%", "31%"], ["69%", "31%"], ["31%", "69%"], ["69%", "69%"]],
  5: [["31%", "31%"], ["69%", "31%"], ["50%", "50%"], ["31%", "69%"], ["69%", "69%"]],
  6: [["31%", "23%"], ["69%", "23%"], ["31%", "50%"], ["69%", "50%"], ["31%", "77%"], ["69%", "77%"]],
};

// Find nearest equivalent angle to avoid spinning the wrong way on settle
function nearestAngle(current: number, target: number): number {
  const delta = ((target - current) % 360 + 540) % 360 - 180;
  return current + delta;
}

interface FaceProps {
  value: number;
  faceTransform: string;
}

function DieFace({ value, faceTransform }: FaceProps) {
  const dots = FACE_DOTS[value] ?? [];
  const isOne = value === 1;

  return (
    <div
      style={{
        position: "absolute",
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE * 0.14,
        background: "linear-gradient(145deg, #ffffff 0%, #f4f4f4 55%, #e6e6e6 100%)",
        boxShadow: [
          "inset 0 1px 3px rgba(255,255,255,0.95)",
          "inset 0 -1px 3px rgba(0,0,0,0.14)",
          "inset 1px 0 3px rgba(255,255,255,0.6)",
          "inset -1px 0 2px rgba(0,0,0,0.08)",
        ].join(", "),
        transform: faceTransform,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {dots.map(([left, top], i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: "50%",
            background: isOne
              ? "radial-gradient(circle at 35% 30%, #ff5555, #cc0000)"
              : "radial-gradient(circle at 35% 30%, #3a3a3a, #111)",
            boxShadow: isOne
              ? "0 1px 4px rgba(180,0,0,0.5)"
              : "0 1px 3px rgba(0,0,0,0.4)",
            transform: "translate(-50%, -50%)",
            left,
            top,
          }}
        />
      ))}
    </div>
  );
}

interface DieProps {
  value: number;
  rolling?: boolean;
  delay?: number; // ms stagger between dice
}

export function Die({ value, rolling = false, delay = 0 }: DieProps) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const ty = useMotionValue(0);
  const prevRolling = useRef(false);
  const delayS = delay / 1000;

  useEffect(() => {
    const wasRolling = prevRolling.current;
    prevRolling.current = rolling;

    if (rolling && !wasRolling) {
      // Phase 1: launch upward then spin fast
      animate(ty, [0, -28, 0], {
        duration: 0.35,
        ease: "easeOut",
        delay: delayS,
      });
      animate(rx, rx.get() + 900 + Math.random() * 540, {
        duration: 0.7,
        ease: [0.4, 0, 0.2, 1],
        delay: delayS,
      });
      animate(ry, ry.get() + 720 + Math.random() * 720, {
        duration: 0.7,
        ease: [0.4, 0, 0.2, 1],
        delay: delayS,
      });
    } else if (!rolling && wasRolling && value) {
      // Phase 2: spring-settle onto the correct face
      const target = FACE_ROT[value];
      const nx = nearestAngle(rx.get(), target.rx);
      const ny = nearestAngle(ry.get(), target.ry);

      animate(rx, nx, {
        type: "spring",
        stiffness: 240,
        damping: 15,
        mass: 1.3,
        delay: delayS,
      });
      animate(ry, ny, {
        type: "spring",
        stiffness: 240,
        damping: 15,
        mass: 1.3,
        delay: delayS,
      });
      // Drop bounce onto the table
      animate(ty, [0, -18, 4, 0], {
        duration: 0.55,
        times: [0, 0.35, 0.65, 1],
        ease: "easeOut",
        delay: delayS,
      });
    }
  }, [rolling, value]);

  return (
    <div
      style={{
        perspective: 700,
        width: SIZE,
        height: SIZE,
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Shadow under the die */}
      <motion.div
        style={{
          position: "absolute",
          bottom: -8,
          left: "50%",
          translateX: "-50%",
          width: SIZE * 0.85,
          height: SIZE * 0.18,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.45)",
          filter: "blur(8px)",
          scaleX: rolling ? 1.2 : 1,
          opacity: rolling ? 0.35 : 0.6,
          transition: "all 0.3s ease",
          zIndex: 0,
        }}
      />

      {/* The 3D cube */}
      <motion.div
        style={{
          width: SIZE,
          height: SIZE,
          position: "relative",
          transformStyle: "preserve-3d",
          rotateX: rx,
          rotateY: ry,
          y: ty,
          zIndex: 1,
        }}
      >
        {/* Face 1 – front */}
        <DieFace value={1} faceTransform={`translateZ(${HALF}px)`} />
        {/* Face 6 – back */}
        <DieFace value={6} faceTransform={`rotateY(180deg) translateZ(${HALF}px)`} />
        {/* Face 2 – right */}
        <DieFace value={2} faceTransform={`rotateY(90deg) translateZ(${HALF}px)`} />
        {/* Face 5 – left */}
        <DieFace value={5} faceTransform={`rotateY(-90deg) translateZ(${HALF}px)`} />
        {/* Face 3 – top */}
        <DieFace value={3} faceTransform={`rotateX(90deg) translateZ(${HALF}px)`} />
        {/* Face 4 – bottom */}
        <DieFace value={4} faceTransform={`rotateX(-90deg) translateZ(${HALF}px)`} />
      </motion.div>
    </div>
  );
}
