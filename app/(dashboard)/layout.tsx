import { requireUser } from "@/lib/auth/require-user";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import { WalletProvider } from "@/lib/contexts/wallet-context";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  const locale = getLocale();
  const t = getT(locale);

  return (
    <WalletProvider>
      <div className="app-shell">
        <DashboardNav locale={locale} t={t.nav} />
        <main className="app-container animate-fade-up pb-20 md:pb-8">{children}</main>
        <MobileBottomNav locale={locale} t={t.nav} />
      </div>
    </WalletProvider>
  );
}
