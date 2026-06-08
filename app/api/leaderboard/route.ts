/**
 * GET /api/leaderboard
 *
 * Returns the top 50 players ranked by total settled P&L.
 * Public endpoint — no auth required.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type LeaderboardEntry = {
  rank: number;
  displayName: string;
  totalPnl: number;
  wins: number;
  losses: number;
  totalRounds: number;
  winRate: number;
};

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;

  // Two separate queries — avoids relying on a Supabase FK join that may
  // not be declared in the schema (silently errors on the join otherwise).
  const { data: posData, error } = await supabase
    .from("positions")
    .select("profile_id, pnl_amount, yes_units, no_units, avg_yes_price, avg_no_price, status")
    .in("status", ["settled", "cancelled"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profileIds = Array.from(
    new Set(
      (posData ?? [])
        .map((r) => r.profile_id as string)
        .filter((id) => !systemAdminId || id !== systemAdminId),
    ),
  );

  const { data: profileData } = profileIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [] };

  const nameMap = new Map<string, string>();
  for (const p of profileData ?? []) {
    const row = p as { id: string; display_name: string | null };
    nameMap.set(row.id, row.display_name ?? "Player");
  }

  // Aggregate by player
  const map = new Map<
    string,
    { displayName: string; totalPnl: number; wins: number; losses: number; total: number }
  >();

  for (const row of posData ?? []) {
    const profileId = row.profile_id as string;
    if (systemAdminId && profileId === systemAdminId) continue;

    const name = nameMap.get(profileId) ?? "Player";

    if ((row as { status?: string }).status === "cancelled") {
      if (!map.has(profileId)) map.set(profileId, { displayName: name, totalPnl: 0, wins: 0, losses: 0, total: 0 });
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
        wins:   netPnl > 0 ? 1 : 0,
        losses: netPnl <= 0 ? 1 : 0,
        total: 1,
      });
    }
  }

  // Sort by total P&L descending, take top 50
  const entries: LeaderboardEntry[] = Array.from(map.entries())
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

  return NextResponse.json({ entries }, { headers: { "Cache-Control": "public, max-age=30" } });
}
