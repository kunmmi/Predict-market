import { requireUser } from "@/lib/auth/require-user";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  const locale = getLocale();
  const t = getT(locale);

  return (
    <div className="app-shell">
      <DashboardNav locale={locale} t={t.nav} />
      <main className="app-container animate-fade-up">{children}</main>
    </div>
  );
}
