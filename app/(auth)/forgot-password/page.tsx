import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  const locale = getLocale();
  const t = getT(locale);

  return <ForgotPasswordForm locale={locale} t={t.auth} />;
}
