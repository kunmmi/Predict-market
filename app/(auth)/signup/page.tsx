import { Suspense } from "react";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  const locale = getLocale();
  const t = getT(locale);

  return (
    <Suspense fallback={null}>
      <SignupForm locale={locale} t={t.auth} />
    </Suspense>
  );
}
