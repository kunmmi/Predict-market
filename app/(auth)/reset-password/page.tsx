import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  const locale = getLocale();
  const t = getT(locale);

  return <ResetPasswordForm locale={locale} t={t.auth} />;
}
