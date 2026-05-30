import Link from "next/link";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";

// Rank badge colors: gold / silver / bronze
const RANK_STYLE: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "rgba(232,160,32,0.15)", color: "var(--gold)", border: "rgba(232,160,32,0.3)" },
  2: { bg: "rgba(180,192,200,0.12)", color: "#B0BEC5", border: "rgba(180,192,200,0.25)" },
  3: { bg: "rgba(180,120,60,0.12)", color: "#C48040", border: "rgba(180,120,60,0.25)" },
};

export function MiniLeaderboardWidget({
  entries,
  zh,
}: {
  entries: LeaderboardEntry[];
  zh: boolean;
}) {
  const top5 = entries.slice(0, 5);

  return (
    <Card>
      <CardHeader style={{ paddingBottom: 8, paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <CardTitle style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy style={{ width: 14, height: 14, color: "var(--gold)" }} />
            {zh ? "排行榜 Top 5" : "Top Players"}
          </CardTitle>
          <Link
            href="/leaderboard"
            style={{
              fontFamily: "var(--font-sans)", fontSize: "0.6875rem",
              fontWeight: 600, color: "var(--gold)", textDecoration: "none",
            }}
            className="hover:opacity-80"
          >
            {zh ? "查看全榜 →" : "Full board →"}
          </Link>
        </div>
      </CardHeader>
      <CardContent style={{ paddingBottom: 16, paddingTop: 4 }}>
        {top5.length === 0 ? (
          <p
            style={{
              padding: "1rem 0", textAlign: "center",
              fontFamily: "var(--font-sans)", fontSize: "0.75rem",
              color: "var(--text-dim)",
            }}
          >
            {zh ? "暂无数据" : "No completed rounds yet"}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {top5.map((e) => {
              const rankStyle = RANK_STYLE[e.rank];
              return (
                <div
                  key={e.rank}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Rank badge — no emoji, styled number */}
                    <span
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                        fontFamily: "var(--font-mono)", fontSize: "0.625rem",
                        fontWeight: 700, letterSpacing: "0.04em",
                        backgroundColor: rankStyle?.bg ?? "var(--bg-elevated)",
                        border: `1px solid ${rankStyle?.border ?? "var(--border-subtle)"}`,
                        color: rankStyle?.color ?? "var(--text-dim)",
                      }}
                    >
                      {e.rank}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)", fontSize: "0.8125rem",
                        fontWeight: 500, color: "var(--text-primary)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        maxWidth: 100,
                      }}
                    >
                      {e.displayName}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {e.totalPnl >= 0 ? (
                      <TrendingUp style={{ width: 11, height: 11, color: "var(--teal)" }} />
                    ) : (
                      <TrendingDown style={{ width: 11, height: 11, color: "var(--rose)" }} />
                    )}
                    <span
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                        fontWeight: 700,
                        color: e.totalPnl >= 0 ? "var(--teal)" : "var(--rose)",
                      }}
                    >
                      {e.totalPnl >= 0 ? "+" : ""}${Math.abs(e.totalPnl).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
