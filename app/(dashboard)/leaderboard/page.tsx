export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";

type LeaderboardResult = {
  top50: LeaderboardEntry[];
  currentUser: (LeaderboardEntry & { profileId: string }) | null;
};

async function getLeaderboard(currentProfileId: string): Promise<LeaderboardResult> {
  const supabase = createSupabaseAdminClient();
  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;

  const { data: posData, error: posError } = await supabase
    .from("positions")
    .select("profile_id, pnl_amount, yes_units, no_units, avg_yes_price, avg_no_price, status")
    .in("status", ["settled", "cancelled"]);

  if (posError || !posData) return { top50: [], currentUser: null };

  const profileIds = Array.from(
    new Set(
      posData
        .map((r) => r.profile_id as string)
        .filter((id) => !systemAdminId || id !== systemAdminId),
    ),
  );

  if (profileIds.length === 0) return { top50: [], currentUser: null };

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", profileIds);

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
    if (row.status === "cancelled") {
      if (!map.has(profileId)) {
        map.set(profileId, { displayName: name, totalPnl: 0, wins: 0, losses: 0, total: 0 });
      }
      continue;
    }
    const payout   = parseFloat(String(row.pnl_amount ?? 0));
    const yesCost  = parseFloat(String(row.yes_units ?? 0)) * parseFloat(String(row.avg_yes_price ?? 0));
    const noCost   = parseFloat(String(row.no_units  ?? 0)) * parseFloat(String(row.avg_no_price  ?? 0));
    const cost     = yesCost + noCost;
    const netPnl   = Math.round((payout - cost) * 100) / 100;

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

  const allRanked: (LeaderboardEntry & { profileId: string })[] = Array.from(map.entries())
    .map(([profileId, v]) => ({
      profileId,
      rank: 0,
      displayName: v.displayName,
      totalPnl: Math.round(v.totalPnl * 100) / 100,
      wins: v.wins,
      losses: v.losses,
      totalRounds: v.total,
      winRate: v.total > 0 ? Math.round((v.wins / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const top50 = allRanked.slice(0, 50);
  let currentUser = allRanked.find((e) => e.profileId === currentProfileId) ?? null;

  // Fallback: query the current user's positions directly in case they were
  // missed by the bulk query (e.g. positions in open/other statuses not included above)
  if (!currentUser) {
    const { data: myPos } = await supabase
      .from("positions")
      .select("pnl_amount, yes_units, no_units, avg_yes_price, avg_no_price, status")
      .eq("profile_id", currentProfileId)
      .not("status", "eq", "open");

    if (myPos && myPos.length > 0) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", currentProfileId)
        .maybeSingle();

      let totalPnl = 0, wins = 0, losses = 0, total = 0;
      for (const p of myPos) {
        if (p.status === "cancelled") continue;
        const payout  = parseFloat(String(p.pnl_amount ?? 0));
        const yesCost = parseFloat(String(p.yes_units ?? 0)) * parseFloat(String(p.avg_yes_price ?? 0));
        const noCost  = parseFloat(String(p.no_units  ?? 0)) * parseFloat(String(p.avg_no_price  ?? 0));
        const netPnl  = Math.round((payout - (yesCost + noCost)) * 100) / 100;
        totalPnl += netPnl;
        total    += 1;
        if (netPnl > 0) wins += 1; else losses += 1;
      }

      if (total > 0) {
        // Find their true rank by counting how many ranked players have a better P&L
        const rank = allRanked.filter((e) => e.totalPnl > totalPnl).length + 1;
        const profileRow = myProfile as { full_name: string | null; email: string | null } | null;
        currentUser = {
          profileId: currentProfileId,
          rank,
          displayName: profileRow?.full_name || (profileRow?.email ? profileRow.email.split("@")[0] : "") || "You",
          totalPnl: Math.round(totalPnl * 100) / 100,
          wins,
          losses,
          totalRounds: total,
          winRate: Math.round((wins / total) * 100),
        };
      }
    }
  }

  return { top50, currentUser };
}

// Rank badge styles — no emoji, styled numbers
const RANK_BADGE: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "rgba(232,160,32,0.15)", color: "var(--gold)",  border: "rgba(232,160,32,0.35)" },
  2: { bg: "rgba(180,192,200,0.10)", color: "#A8BAC4",     border: "rgba(180,192,200,0.22)" },
  3: { bg: "rgba(180,120,60,0.12)",  color: "#C08040",     border: "rgba(180,120,60,0.28)" },
};

export default async function LeaderboardPage() {
  // Hidden until platform has enough users — remove this redirect to re-enable
  redirect("/dashboard");
}

