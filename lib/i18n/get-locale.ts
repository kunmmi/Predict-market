import { cookies } from "next/headers";
import type { Locale } from "./translations";

export function getLocale(): Locale {
  const lang = cookies().get("lang")?.value;
  return lang === "zh" ? "zh" : "en";
}
