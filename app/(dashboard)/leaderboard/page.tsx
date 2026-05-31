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

  const { data: posData, error: posError } = await supabase
    .from("positions")
    .select("profile_id, pnl_amount")
    .eq("status", "settled");

  if (posError || !posData) return [];

  const profileIds = Array.from(
    new Set(
      posData
        .map((r) => r.profile_id as string)
        .filter((id) => !systemAdminId || id !== systemAdminId),
    ),
  );

  if (profileIds.length === 0) return [];

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", profileIds);

  const nameMap = new Map<string, string>();
  for (const p of profileData ?? []) {
    const row = p as { id: string; display_name: string | null };
    nameMap.set(row.id, row.display_name ?? "Player");
  }

  const map = new Map<
    string,
    { displayName: string; totalPnl: number; wins: number; losses: number; total: number }
  >();

  for (const row of posData) {
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

// Rank badge styles — no emoji, styled numbers
const RANK_BADGE: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "rgba(232,160,32,0.15)", color: "var(--gold)",  border: "rgba(232,160,32,0.35)" },
  2: { bg: "rgba(180,192,200,0.10)", color: "#A8BAC4",     border: "rgba(180,192,200,0.22)" },
  3: { bg: "rgba(180,120,60,0.12)",  color: "#C08040",     border: "rgba(180,120,60,0.28)" },
};

export default async function LeaderboardPage() {
  await requireUser();
  const locale = getLocale();
  const zh = locale === "zh";
  const entries = await getLeaderboard();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1 className="page-title">{zh ? "排行榜" : "Leaderboard"}</h1>
        <p className="page-subtitle">
          {zh ? "历史累计盈亏排名 Top 50" : "Top 50 players ranked by all-time profit & loss"}
        </p>
      </div>

      <Card>
        <CardHeader style={{ paddingBottom: 8 }}>
          <CardTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy style={{ width: 16, height: 16, color: "var(--gold)" }} />
            {zh ? "总榜" : "All-Time Rankings"}
          </CardTitle>
        </CardHeader>
        <CardContent style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 8 }}>
          {entries.length === 0 ? (
            <p
              style={{
                padding: "2.5rem 1rem", textAlign: "center",
                fontFamily: "var(--font-sans)", fontSize: "0.875rem",
                color: "var(--text-dim)",
              }}
            >
              {zh ? "暂无数据" : "No completed rounds yet — be the first on the board!"}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {[
                      { label: zh ? "排名" : "Rank",     align: "left",   pl: 20 },
                      { label: zh ? "玩家" : "Player",   align: "left",   pl: 0  },
                      { label: zh ? "轮次" : "Rounds",   align: "center", pl: 0, hide: "sm" },
                      { label: zh ? "胜率" : "Win Rate", align: "center", pl: 0, hide: "sm" },
                      { label: zh ? "胜/负" : "W / L",  align: "center", pl: 0, hide: "md" },
                      { label: zh ? "盈亏" : "P&L",     align: "right",  pr: 20 },
                    ].map(({ label, align, pl, pr, hide }) => (
                      <th
                        key={label}
                        className={hide === "sm" ? "hidden sm:table-cell" : hide === "md" ? "hidden md:table-cell" : ""}
                        style={{
                          paddingBottom: 12,
                          paddingLeft: pl ?? 12,
                          paddingRight: pr ?? 12,
                          textAlign: align as "left" | "right" | "center",
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.5625rem",
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "var(--text-dim)",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const isTop3 = entry.rank <= 3;
                    const isPositive = entry.totalPnl >= 0;
                    const badge = RANK_BADGE[entry.rank];

                    return (
                      <tr
                        key={entry.rank}
                        style={{
                          borderBottom: "1px solid var(--border-dim)",
                          backgroundColor: isTop3 ? "rgba(232,160,32,0.03)" : "transparent",
                          transition: "background-color 150ms ease",
                        }}
                        className="hover:bg-[var(--bg-elevated)]"
                      >
                        {/* Rank */}
                        <td style={{ padding: "14px 12px 14px 20px", verticalAlign: "middle" }}>
                          {badge ? (
                            <span
                              style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 26, height: 26, borderRadius: 6,
                                backgroundColor: badge.bg,
                                border: `1px solid ${badge.border}`,
                                fontFamily: "var(--font-mono)", fontSize: "0.6875rem",
                                fontWeight: 700, color: badge.color,
                              }}
                            >
                              {entry.rank}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontFamily: "var(--font-mono)", fontSize: "0.6875rem",
                                fontWeight: 500, color: "var(--text-dim)",
                              }}
                            >
                              #{entry.rank}
                            </span>
                          )}
                        </td>

                        {/* Player */}
                        <td style={{ padding: "14px 12px", verticalAlign: "middle" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-sans)", fontSize: "0.875rem",
                              fontWeight: isTop3 ? 600 : 500,
                              color: isTop3 ? "var(--text-primary)" : "var(--text-secondary)",
                            }}
                          >
                            {entry.displayName}
                          </span>
                        </td>

                        {/* Rounds */}
                        <td
                          className="hidden sm:table-cell"
                          style={{
                            padding: "14px 12px", textAlign: "center", verticalAlign: "middle",
                            fontFamily: "var(--font-mono)", fontSize: "0.8125rem",
                            fontVariantNumeric: "tabular-nums", color: "var(--text-dim)",
                          }}
                        >
                          {entry.totalRounds}
                        </td>

                        {/* Win rate */}
                        <td
                          className="hidden sm:table-cell"
                          style={{ padding: "14px 12px", textAlign: "center", verticalAlign: "middle" }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-mono)", fontSize: "0.8125rem",
                              fontWeight: 600, fontVariantNumeric: "tabular-nums",
                              color: entry.winRate >= 60
                                ? "var(--teal)"
                                : entry.winRate >= 40
                                  ? "var(--text-secondary)"
                                  : "var(--rose)",
                            }}
                          >
                            {entry.winRate}%
                          </span>
                        </td>

                        {/* W / L */}
                        <td
                          className="hidden md:table-cell"
                          style={{ padding: "14px 12px", textAlign: "center", verticalAlign: "middle" }}
                        >
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: "var(--teal)", fontWeight: 600 }}>{entry.wins}</span>
                            <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>/</span>
                            <span style={{ color: "var(--rose)", fontWeight: 600 }}>{entry.losses}</span>
                          </span>
                        </td>

                        {/* P&L */}
                        <td style={{ padding: "14px 20px 14px 12px", textAlign: "right", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                            {isPositive
                              ? <TrendingUp style={{ width: 13, height: 13, color: "var(--teal)", flexShrink: 0 }} />
                              : <TrendingDown style={{ width: 13, height: 13, color: "var(--rose)", flexShrink: 0 }} />
                            }
                            <span
                              style={{
                                fontFamily: "var(--font-mono)", fontSize: "0.875rem",
                                fontWeight: 700, fontVariantNumeric: "tabular-nums",
                                color: isPositive ? "var(--teal)" : "var(--rose)",
                              }}
                            >
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
