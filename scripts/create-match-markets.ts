/**
 * Seed per-match multi-outcome markets for the 2026 FIFA World Cup Group Stage.
 * Each match: 3-way result (Home Win / Draw / Away Win).
 * Pool weights reflect realistic pre-tournament odds.
 *
 * Usage: npx tsx scripts/create-match-markets.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function getAdminProfileId(): Promise<string> {
  const { data } = await supabase
    .from("markets")
    .select("created_by")
    .eq("asset_symbol", "FIFA")
    .limit(1)
    .single();
  if (!data?.created_by) throw new Error("No FIFA market found");
  return data.created_by as string;
}

type Match = {
  slug: string;
  homeTeam: string;
  homeTeamZh: string;
  awayTeam: string;
  awayTeamZh: string;
  kickoff: string; // ISO UTC
  group: string;
  // Pool weights for (home win / draw / away win) — sum doesn't need to equal 100
  homePool: number;
  drawPool: number;
  awayPool: number;
};

// All 48 group stage matches — WC 2026 (USA/Canada/Mexico)
// Kickoff times are approximate UTC. Group assignments per official draw Dec 2024.
const MATCHES: Match[] = [
  // ── GROUP A (Mexico City / LA / San Francisco) ──
  { slug: "wc26-a1", group: "A", homeTeam: "Mexico",       homeTeamZh: "墨西哥",   awayTeam: "Ecuador",      awayTeamZh: "厄瓜多尔",   kickoff: "2026-06-11T23:00:00Z", homePool: 160, drawPool: 110, awayPool: 80 },
  { slug: "wc26-a2", group: "A", homeTeam: "USA",           homeTeamZh: "美国",     awayTeam: "Bolivia",      awayTeamZh: "玻利维亚",   kickoff: "2026-06-12T02:00:00Z", homePool: 220, drawPool: 90,  awayPool: 40 },
  { slug: "wc26-a3", group: "A", homeTeam: "Mexico",       homeTeamZh: "墨西哥",   awayTeam: "Bolivia",      awayTeamZh: "玻利维亚",   kickoff: "2026-06-16T23:00:00Z", homePool: 240, drawPool: 80,  awayPool: 30 },
  { slug: "wc26-a4", group: "A", homeTeam: "USA",           homeTeamZh: "美国",     awayTeam: "Ecuador",      awayTeamZh: "厄瓜多尔",   kickoff: "2026-06-17T02:00:00Z", homePool: 170, drawPool: 110, awayPool: 70 },
  { slug: "wc26-a5", group: "A", homeTeam: "Ecuador",      homeTeamZh: "厄瓜多尔", awayTeam: "Bolivia",      awayTeamZh: "玻利维亚",   kickoff: "2026-06-21T23:00:00Z", homePool: 190, drawPool: 100, awayPool: 60 },
  { slug: "wc26-a6", group: "A", homeTeam: "Mexico",       homeTeamZh: "墨西哥",   awayTeam: "USA",           awayTeamZh: "美国",       kickoff: "2026-06-22T02:00:00Z", homePool: 130, drawPool: 110, awayPool: 110 },

  // ── GROUP B (Dallas / New York / Boston) ──
  { slug: "wc26-b1", group: "B", homeTeam: "Argentina",    homeTeamZh: "阿根廷",   awayTeam: "Saudi Arabia",  awayTeamZh: "沙特阿拉伯", kickoff: "2026-06-12T23:00:00Z", homePool: 260, drawPool: 70,  awayPool: 30 },
  { slug: "wc26-b2", group: "B", homeTeam: "Australia",    homeTeamZh: "澳大利亚", awayTeam: "Poland",        awayTeamZh: "波兰",       kickoff: "2026-06-13T02:00:00Z", homePool: 130, drawPool: 110, awayPool: 110 },
  { slug: "wc26-b3", group: "B", homeTeam: "Argentina",    homeTeamZh: "阿根廷",   awayTeam: "Poland",        awayTeamZh: "波兰",       kickoff: "2026-06-17T23:00:00Z", homePool: 230, drawPool: 80,  awayPool: 40 },
  { slug: "wc26-b4", group: "B", homeTeam: "Australia",    homeTeamZh: "澳大利亚", awayTeam: "Saudi Arabia",  awayTeamZh: "沙特阿拉伯", kickoff: "2026-06-18T02:00:00Z", homePool: 160, drawPool: 110, awayPool: 80 },
  { slug: "wc26-b5", group: "B", homeTeam: "Poland",       homeTeamZh: "波兰",     awayTeam: "Saudi Arabia",  awayTeamZh: "沙特阿拉伯", kickoff: "2026-06-22T23:00:00Z", homePool: 180, drawPool: 100, awayPool: 70 },
  { slug: "wc26-b6", group: "B", homeTeam: "Argentina",    homeTeamZh: "阿根廷",   awayTeam: "Australia",    awayTeamZh: "澳大利亚",   kickoff: "2026-06-23T02:00:00Z", homePool: 250, drawPool: 75,  awayPool: 30 },

  // ── GROUP C (Miami / Atlanta / Houston) ──
  { slug: "wc26-c1", group: "C", homeTeam: "Brazil",       homeTeamZh: "巴西",     awayTeam: "Nigeria",       awayTeamZh: "尼日利亚",   kickoff: "2026-06-13T20:00:00Z", homePool: 230, drawPool: 85,  awayPool: 40 },
  { slug: "wc26-c2", group: "C", homeTeam: "Colombia",     homeTeamZh: "哥伦比亚", awayTeam: "Panama",        awayTeamZh: "巴拿马",     kickoff: "2026-06-13T23:00:00Z", homePool: 200, drawPool: 90,  awayPool: 60 },
  { slug: "wc26-c3", group: "C", homeTeam: "Brazil",       homeTeamZh: "巴西",     awayTeam: "Panama",        awayTeamZh: "巴拿马",     kickoff: "2026-06-18T20:00:00Z", homePool: 270, drawPool: 60,  awayPool: 20 },
  { slug: "wc26-c4", group: "C", homeTeam: "Colombia",     homeTeamZh: "哥伦比亚", awayTeam: "Nigeria",       awayTeamZh: "尼日利亚",   kickoff: "2026-06-18T23:00:00Z", homePool: 170, drawPool: 100, awayPool: 80 },
  { slug: "wc26-c5", group: "C", homeTeam: "Nigeria",      homeTeamZh: "尼日利亚", awayTeam: "Panama",        awayTeamZh: "巴拿马",     kickoff: "2026-06-22T20:00:00Z", homePool: 200, drawPool: 95,  awayPool: 55 },
  { slug: "wc26-c6", group: "C", homeTeam: "Brazil",       homeTeamZh: "巴西",     awayTeam: "Colombia",      awayTeamZh: "哥伦比亚",   kickoff: "2026-06-22T23:00:00Z", homePool: 170, drawPool: 100, awayPool: 80 },

  // ── GROUP D (Kansas City / Seattle / Vancouver) ──
  { slug: "wc26-d1", group: "D", homeTeam: "France",       homeTeamZh: "法国",     awayTeam: "Albania",       awayTeamZh: "阿尔巴尼亚", kickoff: "2026-06-14T02:00:00Z", homePool: 260, drawPool: 70,  awayPool: 25 },
  { slug: "wc26-d2", group: "D", homeTeam: "Uruguay",      homeTeamZh: "乌拉圭",   awayTeam: "Iraq",          awayTeamZh: "伊拉克",     kickoff: "2026-06-14T20:00:00Z", homePool: 230, drawPool: 80,  awayPool: 40 },
  { slug: "wc26-d3", group: "D", homeTeam: "France",       homeTeamZh: "法国",     awayTeam: "Iraq",          awayTeamZh: "伊拉克",     kickoff: "2026-06-19T02:00:00Z", homePool: 280, drawPool: 60,  awayPool: 15 },
  { slug: "wc26-d4", group: "D", homeTeam: "Uruguay",      homeTeamZh: "乌拉圭",   awayTeam: "Albania",       awayTeamZh: "阿尔巴尼亚", kickoff: "2026-06-19T20:00:00Z", homePool: 200, drawPool: 90,  awayPool: 60 },
  { slug: "wc26-d5", group: "D", homeTeam: "Albania",      homeTeamZh: "阿尔巴尼亚",awayTeam: "Iraq",         awayTeamZh: "伊拉克",     kickoff: "2026-06-23T02:00:00Z", homePool: 150, drawPool: 115, awayPool: 85 },
  { slug: "wc26-d6", group: "D", homeTeam: "France",       homeTeamZh: "法国",     awayTeam: "Uruguay",       awayTeamZh: "乌拉圭",     kickoff: "2026-06-23T20:00:00Z", homePool: 180, drawPool: 105, awayPool: 65 },

  // ── GROUP E (Philadelphia / Toronto / Guadalajara) ──
  { slug: "wc26-e1", group: "E", homeTeam: "Spain",        homeTeamZh: "西班牙",   awayTeam: "Cameroon",      awayTeamZh: "喀麦隆",     kickoff: "2026-06-14T23:00:00Z", homePool: 250, drawPool: 75,  awayPool: 30 },
  { slug: "wc26-e2", group: "E", homeTeam: "Belgium",      homeTeamZh: "比利时",   awayTeam: "Ukraine",       awayTeamZh: "乌克兰",     kickoff: "2026-06-15T02:00:00Z", homePool: 160, drawPool: 110, awayPool: 80 },
  { slug: "wc26-e3", group: "E", homeTeam: "Spain",        homeTeamZh: "西班牙",   awayTeam: "Ukraine",       awayTeamZh: "乌克兰",     kickoff: "2026-06-19T23:00:00Z", homePool: 230, drawPool: 85,  awayPool: 40 },
  { slug: "wc26-e4", group: "E", homeTeam: "Belgium",      homeTeamZh: "比利时",   awayTeam: "Cameroon",      awayTeamZh: "喀麦隆",     kickoff: "2026-06-20T02:00:00Z", homePool: 200, drawPool: 90,  awayPool: 60 },
  { slug: "wc26-e5", group: "E", homeTeam: "Ukraine",      homeTeamZh: "乌克兰",   awayTeam: "Cameroon",      awayTeamZh: "喀麦隆",     kickoff: "2026-06-23T23:00:00Z", homePool: 170, drawPool: 105, awayPool: 75 },
  { slug: "wc26-e6", group: "E", homeTeam: "Spain",        homeTeamZh: "西班牙",   awayTeam: "Belgium",       awayTeamZh: "比利时",     kickoff: "2026-06-24T02:00:00Z", homePool: 180, drawPool: 105, awayPool: 65 },

  // ── GROUP F (San Francisco / New York / Dallas) ──
  { slug: "wc26-f1", group: "F", homeTeam: "Portugal",     homeTeamZh: "葡萄牙",   awayTeam: "Morocco",       awayTeamZh: "摩洛哥",     kickoff: "2026-06-15T20:00:00Z", homePool: 185, drawPool: 100, awayPool: 65 },
  { slug: "wc26-f2", group: "F", homeTeam: "Germany",      homeTeamZh: "德国",     awayTeam: "Korea Republic",awayTeamZh: "韩国",       kickoff: "2026-06-15T23:00:00Z", homePool: 210, drawPool: 90,  awayPool: 50 },
  { slug: "wc26-f3", group: "F", homeTeam: "Portugal",     homeTeamZh: "葡萄牙",   awayTeam: "Korea Republic",awayTeamZh: "韩国",       kickoff: "2026-06-20T20:00:00Z", homePool: 210, drawPool: 88,  awayPool: 52 },
  { slug: "wc26-f4", group: "F", homeTeam: "Germany",      homeTeamZh: "德国",     awayTeam: "Morocco",       awayTeamZh: "摩洛哥",     kickoff: "2026-06-20T23:00:00Z", homePool: 195, drawPool: 95,  awayPool: 60 },
  { slug: "wc26-f5", group: "F", homeTeam: "Korea Republic",homeTeamZh: "韩国",    awayTeam: "Morocco",       awayTeamZh: "摩洛哥",     kickoff: "2026-06-24T20:00:00Z", homePool: 140, drawPool: 115, awayPool: 95 },
  { slug: "wc26-f6", group: "F", homeTeam: "Portugal",     homeTeamZh: "葡萄牙",   awayTeam: "Germany",       awayTeamZh: "德国",       kickoff: "2026-06-24T23:00:00Z", homePool: 165, drawPool: 110, awayPool: 75 },

  // ── GROUP G (Boston / Houston / Vancouver) ──
  { slug: "wc26-g1", group: "G", homeTeam: "England",      homeTeamZh: "英格兰",   awayTeam: "Serbia",        awayTeamZh: "塞尔维亚",   kickoff: "2026-06-16T02:00:00Z", homePool: 210, drawPool: 88,  awayPool: 52 },
  { slug: "wc26-g2", group: "G", homeTeam: "Netherlands",  homeTeamZh: "荷兰",     awayTeam: "Senegal",       awayTeamZh: "塞内加尔",   kickoff: "2026-06-16T20:00:00Z", homePool: 190, drawPool: 95,  awayPool: 65 },
  { slug: "wc26-g3", group: "G", homeTeam: "England",      homeTeamZh: "英格兰",   awayTeam: "Senegal",       awayTeamZh: "塞内加尔",   kickoff: "2026-06-21T02:00:00Z", homePool: 220, drawPool: 85,  awayPool: 45 },
  { slug: "wc26-g4", group: "G", homeTeam: "Netherlands",  homeTeamZh: "荷兰",     awayTeam: "Serbia",        awayTeamZh: "塞尔维亚",   kickoff: "2026-06-21T20:00:00Z", homePool: 185, drawPool: 100, awayPool: 65 },
  { slug: "wc26-g5", group: "G", homeTeam: "Serbia",       homeTeamZh: "塞尔维亚", awayTeam: "Senegal",       awayTeamZh: "塞内加尔",   kickoff: "2026-06-25T02:00:00Z", homePool: 155, drawPool: 115, awayPool: 80 },
  { slug: "wc26-g6", group: "G", homeTeam: "England",      homeTeamZh: "英格兰",   awayTeam: "Netherlands",   awayTeamZh: "荷兰",       kickoff: "2026-06-25T20:00:00Z", homePool: 165, drawPool: 110, awayPool: 75 },

  // ── GROUP H (Atlanta / Seattle / Guadalajara) ──
  { slug: "wc26-h1", group: "H", homeTeam: "Italy",        homeTeamZh: "意大利",   awayTeam: "Ecuador",       awayTeamZh: "厄瓜多尔",   kickoff: "2026-06-16T23:00:00Z", homePool: 195, drawPool: 95,  awayPool: 60 },
  { slug: "wc26-h2", group: "H", homeTeam: "Croatia",      homeTeamZh: "克罗地亚", awayTeam: "Ivory Coast",   awayTeamZh: "科特迪瓦",   kickoff: "2026-06-17T20:00:00Z", homePool: 170, drawPool: 105, awayPool: 75 },
  { slug: "wc26-h3", group: "H", homeTeam: "Italy",        homeTeamZh: "意大利",   awayTeam: "Ivory Coast",   awayTeamZh: "科特迪瓦",   kickoff: "2026-06-21T23:00:00Z", homePool: 210, drawPool: 85,  awayPool: 55 },
  { slug: "wc26-h4", group: "H", homeTeam: "Croatia",      homeTeamZh: "克罗地亚", awayTeam: "Ecuador",       awayTeamZh: "厄瓜多尔",   kickoff: "2026-06-22T20:00:00Z", homePool: 155, drawPool: 115, awayPool: 80 },
  { slug: "wc26-h5", group: "H", homeTeam: "Ivory Coast",  homeTeamZh: "科特迪瓦", awayTeam: "Ecuador",       awayTeamZh: "厄瓜多尔",   kickoff: "2026-06-25T23:00:00Z", homePool: 150, drawPool: 115, awayPool: 85 },
  { slug: "wc26-h6", group: "H", homeTeam: "Italy",        homeTeamZh: "意大利",   awayTeam: "Croatia",       awayTeamZh: "克罗地亚",   kickoff: "2026-06-26T20:00:00Z", homePool: 170, drawPool: 110, awayPool: 70 },
];

async function main() {
  const adminId = await getAdminProfileId();
  console.log(`Admin profile: ${adminId}\n`);

  let created = 0;
  let skipped = 0;

  for (const m of MATCHES) {
    const { data: existing } = await supabase
      .from("markets")
      .select("id")
      .eq("slug", m.slug)
      .maybeSingle();

    if (existing) {
      console.log(`[SKIP] ${m.slug}`);
      skipped++;
      continue;
    }

    const closeAt  = m.kickoff; // market closes at kickoff (no more bets once it starts)
    const settleAt = new Date(new Date(m.kickoff).getTime() + 3 * 60 * 60 * 1000).toISOString(); // +3h

    const title    = `${m.homeTeam} vs ${m.awayTeam} — Match Result`;
    const titleZh  = `${m.homeTeamZh} vs ${m.awayTeamZh} — 比赛结果`;
    const question = `Who wins the Group ${m.group} match: ${m.homeTeam} vs ${m.awayTeam}?`;
    const questionZh = `${m.homeTeamZh} vs ${m.awayTeamZh} 小组赛，哪支球队获胜？`;

    const { data: market, error: mErr } = await supabase
      .from("markets")
      .insert({
        slug:             m.slug,
        title,
        title_zh:         titleZh,
        question_text:    question,
        question_text_zh: questionZh,
        asset_symbol:     "FIFA",
        market_type:      "multi",
        status:           "active",
        category:         `Group ${m.group}`,
        close_at:         closeAt,
        settle_at:        settleAt,
        cutoff_at:        closeAt,
        created_by:       adminId,
      })
      .select("id")
      .single();

    if (mErr || !market) {
      console.error(`[FAIL] ${m.slug}: ${mErr?.message}`);
      continue;
    }

    const total = m.homePool + m.drawPool + m.awayPool;
    const outcomes = [
      { label: `${m.homeTeam} Win`,  label_zh: `${m.homeTeamZh}获胜`, slug: "home",  pool: m.homePool, price: parseFloat((m.homePool / total).toFixed(4)), sort_order: 0 },
      { label: "Draw",               label_zh: "平局",                 slug: "draw",  pool: m.drawPool, price: parseFloat((m.drawPool / total).toFixed(4)), sort_order: 1 },
      { label: `${m.awayTeam} Win`,  label_zh: `${m.awayTeamZh}获胜`, slug: "away",  pool: m.awayPool, price: parseFloat((m.awayPool / total).toFixed(4)), sort_order: 2 },
    ];

    const { error: oErr } = await supabase.from("market_outcomes").insert(
      outcomes.map((o) => ({
        market_id:   market.id,
        label:       o.label,
        label_zh:    o.label_zh,
        slug:        o.slug,
        pool_amount: o.pool,
        price:       o.price,
        sort_order:  o.sort_order,
      }))
    );

    if (oErr) {
      console.error(`[FAIL] outcomes for ${m.slug}: ${oErr.message}`);
      continue;
    }

    console.log(`[OK]  ${m.slug} — ${m.homeTeam} vs ${m.awayTeam} (${Math.round(m.homePool/total*100)}/${Math.round(m.drawPool/total*100)}/${Math.round(m.awayPool/total*100)})`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
