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
        transition: "all 150ms ease",
        flexShrink: 0,
      }}
    >
      {theme === "dark"
        ? <Sun style={{ width: 15, height: 15 }} />
        : <Moon style={{ width: 15, height: 15 }} />}
    </button>
  );
}
