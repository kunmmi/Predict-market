import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { WithdrawPageClient } from "./withdraw-client";

export default function WithdrawPage() {
  const locale = getLocale();
  const t = getT(locale);

  return <WithdrawPageClient t={t.withdraw} locale={locale} />;
}
