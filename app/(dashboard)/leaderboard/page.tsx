export const dynamic = "force-dynamic";

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

    // Cancelled positions are refunded — 0 P&L, don't count as win or loss
    if (row.status === "cancelled") {
      if (!map.has(profileId)) {
        map.set(profileId, { displayName: name, totalPnl: 0, wins: 0, losses: 0, total: 0 });
      }
      continue;
    }
    const payout   = parseFloat(String(row.pnl_amount ?? 0));
    // Original cost = what the user staked (yes side + no side)
    const yesCost  = parseFloat(String(row.yes_units ?? 0)) * parseFloat(String(row.avg_yes_price ?? 0));
    const noCost   = parseFloat(String(row.no_units  ?? 0)) * parseFloat(String(row.avg_no_price  ?? 0));
    const cost     = yesCost + noCost;
    // True net P&L = payout received minus original stake
    const netPnl   = Math.round((payout - cost) * 100) / 100;
    const name     = nameMap.get(profileId) ?? "Player";

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
  const currentUser = allRanked.find((e) => e.profileId === currentProfileId) ?? null;

  return { top50, currentUser };
}

// Rank badge styles — no emoji, styled numbers
const RANK_BADGE: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "rgba(232,160,32,0.15)", color: "var(--gold)",  border: "rgba(232,160,32,0.35)" },
  2: { bg: "rgba(180,192,200,0.10)", color: "#A8BAC4",     border: "rgba(180,192,200,0.22)" },
  3: { bg: "rgba(180,120,60,0.12)",  color: "#C08040",     border: "rgba(180,120,60,0.28)" },
};

export default async function LeaderboardPage() {
  const { profile } = await requireUser();
  const locale = getLocale();
  const zh = locale === "zh";
  const { top50: entries, currentUser } = await getLeaderboard(profile.id);
  const currentUserInTop50 = currentUser != null && currentUser.rank <= 50;

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
                    const isMe = currentUser?.rank === entry.rank && currentUserInTop50;

                    return (
                      <tr
                        key={entry.rank}
                        style={{
                          borderBottom: "1px solid var(--border-dim)",
                          backgroundColor: isMe
                            ? "rgba(16,207,160,0.07)"
                            : isTop3 ? "rgba(232,160,32,0.03)" : "transparent",
                          transition: "background-color 150ms ease",
                          outline: isMe ? "1px solid rgba(16,207,160,0.25)" : undefined,
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
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                fontFamily: "var(--font-sans)", fontSize: "0.875rem",
                                fontWeight: isTop3 || isMe ? 600 : 500,
                                color: isMe ? "var(--teal)" : isTop3 ? "var(--text-primary)" : "var(--text-secondary)",
                              }}
                            >
                              {entry.displayName}
                            </span>
                            {isMe && (
                              <span style={{
                                fontFamily: "var(--font-mono)", fontSize: "0.5625rem",
                                fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                                color: "var(--teal)", backgroundColor: "rgba(16,207,160,0.12)",
                                border: "1px solid rgba(16,207,160,0.25)",
                                borderRadius: 4, padding: "1px 6px",
                              }}>
                                {zh ? "我" : "You"}
                              </span>
                            )}
                          </div>
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
      {/* Not yet on the board */}
      {!currentUser && (
        <div style={{
          padding: "1rem 1.25rem",
          borderRadius: "var(--radius-lg)",
          border: "1px dashed var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
          fontFamily: "var(--font-sans)", fontSize: "0.875rem",
          color: "var(--text-dim)", textAlign: "center",
        }}>
          {zh ? "你还没有完成任何交易轮次，完成后将出现在排行榜上。" : "You don't have any completed rounds yet — your rank will appear here once you do."}
        </div>
      )}

      {/* Your Rank — shown only when the current user is outside the top 50 */}
      {currentUser && !currentUserInTop50 && (
        <Card style={{ borderColor: "rgba(16,207,160,0.25)", backgroundColor: "rgba(16,207,160,0.04)" }}>
          <CardHeader style={{ paddingBottom: 8 }}>
            <CardTitle style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--teal)" }}>
              <Trophy style={{ width: 16, height: 16, color: "var(--teal)" }} />
              {zh ? "我的排名" : "Your Ranking"}
            </CardTitle>
          </CardHeader>
          <CardContent style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "14px 12px 14px 20px", verticalAlign: "middle" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.6875rem",
                      fontWeight: 500, color: "var(--text-dim)",
                    }}>
                      #{currentUser.rank}
                    </span>
                  </td>
                  <td style={{ padding: "14px 12px", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 600, color: "var(--teal)" }}>
                        {currentUser.displayName}
                      </span>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "0.5625rem", fontWeight: 700,
                        letterSpacing: "0.1em", textTransform: "uppercase",
                        color: "var(--teal)", backgroundColor: "rgba(16,207,160,0.12)",
                        border: "1px solid rgba(16,207,160,0.25)", borderRadius: 4, padding: "1px 6px",
                      }}>
                        {zh ? "我" : "You"}
                      </span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell" style={{ padding: "14px 12px", textAlign: "center", verticalAlign: "middle", fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums", color: "var(--text-dim)" }}>
                    {currentUser.totalRounds}
                  </td>
                  <td className="hidden sm:table-cell" style={{ padding: "14px 12px", textAlign: "center", verticalAlign: "middle" }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      color: currentUser.winRate >= 60 ? "var(--teal)" : currentUser.winRate >= 40 ? "var(--text-secondary)" : "var(--rose)",
                    }}>
                      {currentUser.winRate}%
                    </span>
                  </td>
                  <td className="hidden md:table-cell" style={{ padding: "14px 12px", textAlign: "center", verticalAlign: "middle" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ color: "var(--teal)", fontWeight: 600 }}>{currentUser.wins}</span>
                      <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>/</span>
                      <span style={{ color: "var(--rose)", fontWeight: 600 }}>{currentUser.losses}</span>
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px 14px 12px", textAlign: "right", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                      {currentUser.totalPnl >= 0
                        ? <TrendingUp style={{ width: 13, height: 13, color: "var(--teal)", flexShrink: 0 }} />
                        : <TrendingDown style={{ width: 13, height: 13, color: "var(--rose)", flexShrink: 0 }} />
                      }
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        color: currentUser.totalPnl >= 0 ? "var(--teal)" : "var(--rose)",
                      }}>
                        {currentUser.totalPnl >= 0 ? "+" : ""}${Math.abs(currentUser.totalPnl).toFixed(2)}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
