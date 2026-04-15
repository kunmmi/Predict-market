import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { DepositPageClient } from "./deposit-client";

export default function DepositPage() {
  const locale = getLocale();
  const t = getT(locale);

  return <DepositPageClient t={t.deposit} locale={locale} />;
}
