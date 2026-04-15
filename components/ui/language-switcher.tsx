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
    <div className="flex items-center overflow-hidden rounded-md border border-slate-700 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 transition-colors ${
          locale === "en"
            ? "bg-yellow-400 text-slate-900"
            : "text-slate-400 hover:text-white"
        }`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("zh")}
        className={`px-2.5 py-1 transition-colors ${
          locale === "zh"
            ? "bg-yellow-400 text-slate-900"
            : "text-slate-400 hover:text-white"
        }`}
        aria-pressed={locale === "zh"}
      >
        中文
      </button>
    </div>
  );
}
