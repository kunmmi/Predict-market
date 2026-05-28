export const dynamic = "force-dynamic";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { requireUser } from "@/lib/auth/require-user";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getDashboardData } from "@/lib/services/dashboard-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";

async function getTopPlayers(): Promise<LeaderboardEntry[]> {
  const supabase = createSupabaseAdminClient();
  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;

  const { data } = await supabase
    .from("positions")
    .select("profile_id, pnl_amount, profiles ( display_name )")
    .eq("status", "settled");

  if (!data) return [];

  const map = new Map<
    string,
    { displayName: string; totalPnl: number; wins: number; losses: number; total: number }
  >();

  for (const row of data) {
    const profileId = row.profile_id as string;
    if (systemAdminId && profileId === systemAdminId) continue;
    const pnl = parseFloat(String(row.pnl_amount ?? 0));
    const profile = row.profiles as unknown as { display_name: string | null } | null;
    const name = profile?.display_name ?? "Player";
    const existing = map.get(profileId);
    if (existing) {
      existing.totalPnl += pnl;
      existing.total += 1;
      if (pnl > 0) existing.wins += 1;
      else if (pnl < 0) existing.losses += 1;
    } else {
      map.set(profileId, {
        displayName: name,
        totalPnl: pnl,
        wins: pnl > 0 ? 1 : 0,
        losses: pnl < 0 ? 1 : 0,
        total: 1,
      });
    }
  }

  return Array.from(map.entries())
    .map(([, v]) => ({
      rank: 0,
      displayName: v.displayName,
      totalPnl: Math.round(v.totalPnl * 100) / 100,
      wins: v.wins,
      losses: v.losses,
      totalRounds: v.total,
      winRate: v.total > 0 ? Math.round((v.wins / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .slice(0, 5)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export default async function DashboardPage() {
  const { profile, wallet } = await requireUser();
  const [data, topPlayers] = await Promise.all([
    getDashboardData(profile.id),
    getTopPlayers(),
  ]);
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
      topPlayers={topPlayers}
      showAdminLink={profile.role === "admin"}
      locale={locale}
      t={t.dashboard}
    />
  );
}
