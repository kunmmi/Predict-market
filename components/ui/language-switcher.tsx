"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/translations";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();

  function setLang(lang: Locale) {
    document.cookie = `lang=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        borderRadius: 8,
        border: "1px solid var(--border-subtle)",
        fontSize: "11px",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {(["en", "zh"] as Locale[]).map((lang) => {
        const isActive = locale === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => setLang(lang)}
            aria-pressed={isActive}
            style={{
              padding: "5px 10px",
              cursor: "pointer",
              transition: "all 150ms ease",
              background: isActive
                ? "linear-gradient(135deg, var(--gold-btn-light) 0%, var(--gold-btn) 100%)"
                : "transparent",
              color: isActive ? "#070809" : "var(--text-dim)",
              border: "none",
              borderLeft: lang === "zh" ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            {lang === "en" ? "EN" : "中文"}
          </button>
        );
      })}
    </div>
  );
}
