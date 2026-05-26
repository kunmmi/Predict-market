export const dynamic = "force-dynamic";

import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = createSupabaseAdminClient();
  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;

  const { data, error } = await supabase
    .from("positions")
    .select("profile_id, pnl_amount, profiles ( display_name )")
    .eq("status", "settled");

  if (error || !data) return [];

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
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default async function LeaderboardPage() {
  await requireUser();
  const locale = getLocale();
  const zh = locale === "zh";
  const entries = await getLeaderboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{zh ? "排行榜" : "Leaderboard"}</h1>
        <p className="page-subtitle">
          {zh ? "历史累计盈亏排名 Top 50" : "Top 50 players ranked by all-time profit & loss"}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Trophy className="h-4 w-4 text-yellow-500" />
            {zh ? "总榜" : "All-Time Rankings"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {zh ? "暂无数据" : "No completed rounds yet — be the first on the board!"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pl-4 pr-3 text-left">{zh ? "排名" : "Rank"}</th>
                    <th className="pb-3 pr-3 text-left">{zh ? "玩家" : "Player"}</th>
                    <th className="hidden pb-3 pr-3 text-center sm:table-cell">{zh ? "轮次" : "Rounds"}</th>
                    <th className="hidden pb-3 pr-3 text-center sm:table-cell">{zh ? "胜率" : "Win Rate"}</th>
                    <th className="hidden pb-3 pr-3 text-center md:table-cell">{zh ? "胜/负" : "W / L"}</th>
                    <th className="pb-3 pr-4 text-right">{zh ? "盈亏" : "P&L"}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const isTop3 = entry.rank <= 3;
                    const isPositive = entry.totalPnl >= 0;
                    return (
                      <tr
                        key={entry.rank}
                        className={`border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/60 ${
                          isTop3 ? "bg-yellow-50/40" : ""
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3 pl-4 pr-3">
                          {MEDAL[entry.rank] ? (
                            <span className="text-base">{MEDAL[entry.rank]}</span>
                          ) : (
                            <span className="font-mono text-xs text-slate-400">#{entry.rank}</span>
                          )}
                        </td>

                        {/* Player name */}
                        <td className="py-3 pr-3">
                          <span className={`font-semibold ${isTop3 ? "text-slate-900" : "text-slate-700"}`}>
                            {entry.displayName}
                          </span>
                        </td>

                        {/* Rounds */}
                        <td className="hidden py-3 pr-3 text-center tabular-nums text-slate-500 sm:table-cell">
                          {entry.totalRounds}
                        </td>

                        {/* Win rate */}
                        <td className="hidden py-3 pr-3 text-center sm:table-cell">
                          <span className={`font-medium tabular-nums ${
                            entry.winRate >= 60 ? "text-green-600" :
                            entry.winRate >= 40 ? "text-slate-600" : "text-red-500"
                          }`}>
                            {entry.winRate}%
                          </span>
                        </td>

                        {/* W / L */}
                        <td className="hidden py-3 pr-3 text-center md:table-cell">
                          <span className="text-xs text-slate-500 tabular-nums">
                            <span className="text-green-600 font-medium">{entry.wins}</span>
                            {" / "}
                            <span className="text-red-500 font-medium">{entry.losses}</span>
                          </span>
                        </td>

                        {/* P&L */}
                        <td className="py-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPositive ? (
                              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                            )}
                            <span className={`font-bold tabular-nums ${
                              isPositive ? "text-green-600" : "text-red-500"
                            }`}>
                              {isPositive ? "+" : ""}${Math.abs(entry.totalPnl).toFixed(2)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
