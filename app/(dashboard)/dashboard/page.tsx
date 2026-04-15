import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { requireUser } from "@/lib/auth/require-user";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getDashboardData } from "@/lib/services/dashboard-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";

export default async function DashboardPage() {
  const { profile, wallet } = await requireUser();
  const data = await getDashboardData(profile.id);
  const locale = getLocale();
  const t = getT(locale);

  return (
    <DashboardOverview
      email={profile.email}
      fullName={profile.full_name}
      role={profile.role}
      profileStatus={profile.status}
      walletBalance={wallet ? formatDecimal(wallet.balance) : null}
      walletAvailable={wallet ? formatDecimal(wallet.available_balance) : null}
      walletStatus={wallet?.status ?? null}
      data={data}
      showAdminLink={profile.role === "admin"}
      locale={locale}
      t={t.dashboard}
    />
  );
}
