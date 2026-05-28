import Link from "next/link";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

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
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm font-bold">
            <Trophy className="h-4 w-4 text-yellow-500" />
            {zh ? "排行榜 Top 5" : "Top Players"}
          </CardTitle>
          <Link
            href="/leaderboard"
            className="text-xs font-semibold text-yellow-600 hover:text-yellow-700"
          >
            {zh ? "查看全榜 →" : "Full board →"}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-1">
        {top5.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">
            {zh ? "暂无数据" : "No completed rounds yet"}
          </p>
        ) : (
          <div className="space-y-2.5">
            {top5.map((e) => (
              <div key={e.rank} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-sm">
                    {MEDAL[e.rank] ?? (
                      <span className="font-mono text-xs text-slate-400">
                        #{e.rank}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-800">
                    {e.displayName}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {e.totalPnl >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  )}
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      e.totalPnl >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {e.totalPnl >= 0 ? "+" : ""}${Math.abs(e.totalPnl).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
