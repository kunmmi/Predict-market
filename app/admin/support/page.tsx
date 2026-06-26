export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { SupportInbox } from "./support-inbox";

export default async function AdminSupportPage() {
  await requireAdmin();
  const locale = getLocale();
  return <SupportInbox locale={locale === "zh" ? "zh" : "en"} />;
}
