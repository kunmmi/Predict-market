import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { SupportContent } from "./support-content";

export default function SupportPage() {
  const locale = getLocale();
  const t = getT(locale);
  return <SupportContent locale={locale} t={t.support} />;
}
