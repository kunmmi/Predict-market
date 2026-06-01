"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/contexts/theme-context";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: 8,
        border: "1px solid var(--border-subtle)",
        backgroundColor: "transparent",
        color: "var(--text-secondary)",
        cursor: "pointer",
        transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 100ms cubic-bezier(0.22, 1, 0.36, 1)",
        flexShrink: 0,
      }}
    >
      <span
        key={theme}
        style={{
          display: "flex",
          animation: "scaleIn 200ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {theme === "dark"
          ? <Sun style={{ width: 15, height: 15 }} />
          : <Moon style={{ width: 15, height: 15 }} />}
      </span>
    </button>
  );
}
