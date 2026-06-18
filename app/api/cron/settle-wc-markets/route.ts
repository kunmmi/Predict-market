/**
 * GET /api/cron/settle-wc-markets
 *
 * Runs on a schedule (every 2 hours via Vercel cron).
 * Fetches completed World Cup 2026 match results from the openfootball
 * open-data JSON (no API key required) and auto-settles any active
 * WC match markets whose close_at is in the past.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Normalise team names to handle variations between openfootball and our market titles
const TEAM_ALIASES: Record<string, string> = {
  "ir iran":          "iran",
  "korea republic":   "south korea",
  "korea dpr":        "north korea",
  "usa":              "usa",
  "united states":    "usa",
  "czechia":          "czech republic",
  "ivory coast":      "ivory coast",
  "côte d'ivoire":    "ivory coast",
  "cape verde":       "cape verde",
  "cabo verde":       "cape verde",
  "dr congo":         "dr congo",
  "congo dr":         "dr congo",
  "democratic republic of congo": "dr congo",
};

function normalise(name: string): string {
  const lower = name.toLowerCase().trim();
  return TEAM_ALIASES[lower] ?? lower;
}

interface OpenFootballMatch {
  date?: string;
  team1?: string;
  team2?: string;
  score?: { ft?: [number, number] };
}

interface OpenFootballRound {
  name?: string;
  matches?: OpenFootballMatch[];
}

interface OpenFootballData {
  rounds?: OpenFootballRound[];
  matches?: OpenFootballMatch[];
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // 1. Fetch openfootball WC 2026 data
  let wc: OpenFootballData;
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
      { next: { revalidate: 0 } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    wc = await res.json();
  } catch (err) {
    return NextResponse.json(
      { success: false, message: `Failed to fetch openfootball data: ${err instanceof Error ? err.message : err}` },
      { status: 502 },
    );
  }

  // 2. Collect all completed matches from openfootball
  const completedMatches: { team1: string; team2: string; result: "home" | "draw" | "away" }[] = [];

  // Support both flat `matches` array and nested `rounds[].matches`
  const allMatches: OpenFootballMatch[] = [
    ...(wc.matches ?? []),
    ...(wc.rounds ?? []).flatMap((r) => r.matches ?? []),
  ];

  for (const match of allMatches) {
    if (!match.score?.ft || !match.team1 || !match.team2) continue;
    const [g1, g2] = match.score.ft;
    const result: "home" | "draw" | "away" = g1 > g2 ? "home" : g1 < g2 ? "away" : "draw";
    completedMatches.push({
      team1: normalise(match.team1),
      team2: normalise(match.team2),
      result,
    });
  }

  if (completedMatches.length === 0) {
    return NextResponse.json({ success: true, message: "No completed matches found in openfootball data.", settled: 0 });
  }

  // 3. Fetch all active WC match markets past their close_at
  const now = new Date().toISOString();
  const { data: markets, error: mErr } = await supabase
    .from("markets")
    .select("id, slug, title")
    .eq("market_type", "multi")
    .eq("status", "active")
    .like("slug", "wc26-%")
    .not("slug", "like", "wc-2026%") // exclude tournament-level markets
    .lt("close_at", now);

  if (mErr) {
    return NextResponse.json({ success: false, message: `DB error: ${mErr.message}` }, { status: 500 });
  }

  if (!markets || markets.length === 0) {
    return NextResponse.json({ success: true, message: "No active WC markets past close_at.", settled: 0 });
  }

  // 4. Match each market to an openfootball result by team names in title
  const results: { slug: string; status: string; winner?: string }[] = [];

  for (const market of markets) {
    const titleLower = market.title.toLowerCase();

    const match = completedMatches.find(
      (m) => titleLower.includes(m.team1) && titleLower.includes(m.team2),
    );

    if (!match) {
      results.push({ slug: market.slug, status: "no_result_yet" });
      continue;
    }

    // 5. Get outcomes for this market
    const { data: outcomes } = await supabase
      .from("market_outcomes")
      .select("id, slug, label")
      .eq("market_id", market.id);

    if (!outcomes?.length) {
      results.push({ slug: market.slug, status: "no_outcomes" });
      continue;
    }

    const winner = outcomes.find((o) => o.slug === match.result);
    if (!winner) {
      results.push({ slug: market.slug, status: `outcome_slug_missing:${match.result}` });
      continue;
    }

    // 6. Settle via RPC
    const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID ?? "95e54b07-875b-4482-9787-28d3795571c0";
    const { error: rpcErr } = await supabase.rpc("settle_multi_market", {
      p_market_id:         market.id,
      p_winner_outcome_id: winner.id,
      p_admin_profile_id:  systemAdminId,
      p_notes:             `Auto-settled: ${winner.label} (openfootball data)`,
    });

    if (rpcErr) {
      results.push({ slug: market.slug, status: `rpc_error: ${rpcErr.message}` });
    } else {
      results.push({ slug: market.slug, status: "settled", winner: winner.label });
    }
  }

  const settled = results.filter((r) => r.status === "settled").length;
  const pending = results.filter((r) => r.status === "no_result_yet").length;
  const failed  = results.filter((r) => !["settled", "no_result_yet"].includes(r.status)).length;

  return NextResponse.json({
    success: true,
    settled,
    pending,
    failed,
    results,
    timestamp: new Date().toISOString(),
  });
}
