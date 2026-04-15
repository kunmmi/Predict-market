import { Suspense } from "react";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const locale = getLocale();
  const t = getT(locale);

  return (
    <Suspense fallback={null}>
      <LoginForm locale={locale} t={t.auth} />
    </Suspense>
  );
}
