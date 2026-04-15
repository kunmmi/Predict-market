import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "@/components/layout/admin-nav";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdmin();
  const locale = getLocale();
  const t = getT(locale);

  return (
    <div className="app-shell">
      <AdminNav locale={locale} t={t.nav} />
      <main className="app-container animate-fade-up">{children}</main>
    </div>
  );
}
