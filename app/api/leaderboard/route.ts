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
    .select("profile_id, pnl_amount")
    .eq("status", "settled");

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

    const pnl = parseFloat(String(row.pnl_amount ?? 0));
    const name = nameMap.get(profileId) ?? "Player";

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
