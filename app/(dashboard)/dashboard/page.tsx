export const dynamic = "force-dynamic";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { DepositPoller } from "@/components/wallet/deposit-poller";
import { requireUser } from "@/lib/auth/require-user";
import { formatDecimal } from "@/lib/helpers/format-decimal";
import { getDashboardData } from "@/lib/services/dashboard-data";
import { getLocale } from "@/lib/i18n/get-locale";
import { getT } from "@/lib/i18n/translations";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";

async function getTopPlayers(): Promise<LeaderboardEntry[]> {
  const supabase = createSupabaseAdminClient();
  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;

  const { data: posData } = await supabase
    .from("positions")
    .select("profile_id, pnl_amount, yes_units, no_units, avg_yes_price, avg_no_price, status")
    .in("status", ["settled", "cancelled"]);

  if (!posData) return [];

  const profileIds = Array.from(
    new Set(
      posData
        .map((r) => r.profile_id as string)
        .filter((id) => !systemAdminId || id !== systemAdminId),
    ),
  );

  const { data: profileData } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
    : { data: [] };

  const nameMap = new Map<string, string>();
  for (const p of profileData ?? []) {
    const row = p as { id: string; full_name: string | null; email: string | null };
    const name = row.full_name || (row.email ? row.email.split("@")[0] : "") || "Player";
    nameMap.set(row.id, name);
  }

  const map = new Map<
    string,
    { displayName: string; totalPnl: number; wins: number; losses: number; total: number }
  >();

  for (const row of posData) {
    const profileId = row.profile_id as string;
    if (systemAdminId && profileId === systemAdminId) continue;

    const name = nameMap.get(profileId) ?? "Player";

    // Cancelled positions are refunded — 0 P&L, don't count as win or loss
    if ((row as { status?: string }).status === "cancelled") {
      if (!map.has(profileId)) {
        map.set(profileId, { displayName: name, totalPnl: 0, wins: 0, losses: 0, total: 0 });
      }
      continue;
    }

    const payout  = parseFloat(String(row.pnl_amount ?? 0));
    const yesCost = parseFloat(String(row.yes_units ?? 0)) * parseFloat(String(row.avg_yes_price ?? 0));
    const noCost  = parseFloat(String(row.no_units  ?? 0)) * parseFloat(String(row.avg_no_price  ?? 0));
    const netPnl  = Math.round((payout - (yesCost + noCost)) * 100) / 100;

    const existing = map.get(profileId);
    if (existing) {
      existing.totalPnl += netPnl;
      existing.total    += 1;
      if (netPnl > 0) existing.wins   += 1;
      else            existing.losses += 1;
    } else {
      map.set(profileId, {
        displayName: name,
        totalPnl: netPnl,
        wins:    netPnl > 0 ? 1 : 0,
        losses:  netPnl <= 0 ? 1 : 0,
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
    <>
      <DepositPoller />
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
    </>
  );
}
