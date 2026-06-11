/**
 * Replaces all incorrect wc26-* match markets with the real 2026 FIFA World Cup
 * group stage fixtures (Groups A–L, 72 matches).
 *
 * Steps:
 *   1. Cancel & rename existing wc26-* markets to avoid slug collisions.
 *   2. Insert all 72 correct markets with proper teams, groups, and UTC kickoff times.
 *
 * Usage: npx tsx scripts/create-real-match-markets.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

// ── Types ─────────────────────────────────────────────────────────────────────

interface Fixture {
  slug: string;
  group: string;
  home: string;
  home_zh: string;
  away: string;
  away_zh: string;
  kickoffUtc: string; // ISO datetime string (UTC)
  homePool: number;
  drawPool: number;
  awayPool: number;
}

// ── Real 2026 World Cup group-stage fixtures ──────────────────────────────────
// All times are UTC. Source: Sky Sports schedule (BST − 1h = UTC).
// Groups A–L, 4 teams each, 6 matches per group = 72 total.

const FIXTURES: Fixture[] = [
  // ────────────────── GROUP A: Mexico, South Africa, South Korea, Czechia ──
  { slug:"wc26-a1", group:"Group A", home:"Mexico",       home_zh:"墨西哥",   away:"South Africa",  away_zh:"南非",   kickoffUtc:"2026-06-11T19:00:00Z", homePool:190, drawPool:100, awayPool:60  },
  { slug:"wc26-a2", group:"Group A", home:"South Korea",  home_zh:"韩国",    away:"Czech Republic",away_zh:"捷克",   kickoffUtc:"2026-06-12T02:00:00Z", homePool:150, drawPool:120, awayPool:90  },
  { slug:"wc26-a3", group:"Group A", home:"Czech Republic",home_zh:"捷克",   away:"South Africa",  away_zh:"南非",   kickoffUtc:"2026-06-18T16:00:00Z", homePool:160, drawPool:110, awayPool:80  },
  { slug:"wc26-a4", group:"Group A", home:"Mexico",       home_zh:"墨西哥",   away:"South Korea",   away_zh:"韩国",   kickoffUtc:"2026-06-19T01:00:00Z", homePool:160, drawPool:100, awayPool:90  },
  { slug:"wc26-a5", group:"Group A", home:"South Africa", home_zh:"南非",    away:"South Korea",   away_zh:"韩国",   kickoffUtc:"2026-06-25T01:00:00Z", homePool:100, drawPool:120, awayPool:130 },
  { slug:"wc26-a6", group:"Group A", home:"Czech Republic",home_zh:"捷克",   away:"Mexico",        away_zh:"墨西哥", kickoffUtc:"2026-06-25T01:00:00Z", homePool:130, drawPool:110, awayPool:120 },

  // ────────────────── GROUP B: Canada, Bosnia-Herzegovina, Qatar, Switzerland ──
  { slug:"wc26-b1", group:"Group B", home:"Canada",       home_zh:"加拿大",  away:"Bosnia-Herzegovina",away_zh:"波黑",kickoffUtc:"2026-06-12T19:00:00Z", homePool:170, drawPool:100, awayPool:80  },
  { slug:"wc26-b2", group:"Group B", home:"Qatar",        home_zh:"卡塔尔",  away:"Switzerland",   away_zh:"瑞士",   kickoffUtc:"2026-06-13T19:00:00Z", homePool:80,  drawPool:110, awayPool:160 },
  { slug:"wc26-b3", group:"Group B", home:"Switzerland",  home_zh:"瑞士",    away:"Bosnia-Herzegovina",away_zh:"波黑",kickoffUtc:"2026-06-18T19:00:00Z", homePool:180, drawPool:100, awayPool:70  },
  { slug:"wc26-b4", group:"Group B", home:"Canada",       home_zh:"加拿大",  away:"Qatar",         away_zh:"卡塔尔", kickoffUtc:"2026-06-18T22:00:00Z", homePool:220, drawPool:70,  awayPool:60  },
  { slug:"wc26-b5", group:"Group B", home:"Switzerland",  home_zh:"瑞士",    away:"Canada",        away_zh:"加拿大", kickoffUtc:"2026-06-24T19:00:00Z", homePool:150, drawPool:110, awayPool:90  },
  { slug:"wc26-b6", group:"Group B", home:"Bosnia-Herzegovina",home_zh:"波黑",away:"Qatar",        away_zh:"卡塔尔", kickoffUtc:"2026-06-24T19:00:00Z", homePool:170, drawPool:100, awayPool:80  },

  // ────────────────── GROUP C: Brazil, Haiti, Morocco, Scotland ──
  { slug:"wc26-c1", group:"Group C", home:"Brazil",       home_zh:"巴西",    away:"Morocco",       away_zh:"摩洛哥", kickoffUtc:"2026-06-13T22:00:00Z", homePool:220, drawPool:80,  awayPool:50  },
  { slug:"wc26-c2", group:"Group C", home:"Haiti",        home_zh:"海地",    away:"Scotland",      away_zh:"苏格兰", kickoffUtc:"2026-06-14T01:00:00Z", homePool:90,  drawPool:110, awayPool:160 },
  { slug:"wc26-c3", group:"Group C", home:"Scotland",     home_zh:"苏格兰",  away:"Morocco",       away_zh:"摩洛哥", kickoffUtc:"2026-06-19T22:00:00Z", homePool:120, drawPool:120, awayPool:110 },
  { slug:"wc26-c4", group:"Group C", home:"Brazil",       home_zh:"巴西",    away:"Haiti",         away_zh:"海地",   kickoffUtc:"2026-06-20T00:30:00Z", homePool:280, drawPool:50,  awayPool:20  },
  { slug:"wc26-c5", group:"Group C", home:"Morocco",      home_zh:"摩洛哥",  away:"Haiti",         away_zh:"海地",   kickoffUtc:"2026-06-24T22:00:00Z", homePool:200, drawPool:90,  awayPool:60  },
  { slug:"wc26-c6", group:"Group C", home:"Scotland",     home_zh:"苏格兰",  away:"Brazil",        away_zh:"巴西",   kickoffUtc:"2026-06-24T22:00:00Z", homePool:60,  drawPool:90,  awayPool:200 },

  // ────────────────── GROUP D: Australia, Paraguay, Turkey, USA ──
  { slug:"wc26-d1", group:"Group D", home:"USA",          home_zh:"美国",    away:"Paraguay",      away_zh:"巴拉圭", kickoffUtc:"2026-06-13T01:00:00Z", homePool:180, drawPool:90,  awayPool:80  },
  { slug:"wc26-d2", group:"Group D", home:"Australia",    home_zh:"澳大利亚", away:"Turkey",        away_zh:"土耳其", kickoffUtc:"2026-06-14T04:00:00Z", homePool:120, drawPool:110, awayPool:120 },
  { slug:"wc26-d3", group:"Group D", home:"USA",          home_zh:"美国",    away:"Australia",     away_zh:"澳大利亚",kickoffUtc:"2026-06-19T19:00:00Z", homePool:190, drawPool:85,  awayPool:75  },
  { slug:"wc26-d4", group:"Group D", home:"Turkey",       home_zh:"土耳其",  away:"Paraguay",      away_zh:"巴拉圭", kickoffUtc:"2026-06-20T03:00:00Z", homePool:150, drawPool:110, awayPool:90  },
  { slug:"wc26-d5", group:"Group D", home:"Turkey",       home_zh:"土耳其",  away:"USA",           away_zh:"美国",   kickoffUtc:"2026-06-26T02:00:00Z", homePool:100, drawPool:110, awayPool:140 },
  { slug:"wc26-d6", group:"Group D", home:"Paraguay",     home_zh:"巴拉圭",  away:"Australia",     away_zh:"澳大利亚",kickoffUtc:"2026-06-26T02:00:00Z", homePool:140, drawPool:110, awayPool:100 },

  // ────────────────── GROUP E: Curaçao, Ecuador, Germany, Ivory Coast ──
  { slug:"wc26-e1", group:"Group E", home:"Germany",      home_zh:"德国",    away:"Curaçao",       away_zh:"库拉索", kickoffUtc:"2026-06-14T17:00:00Z", homePool:280, drawPool:60,  awayPool:20  },
  { slug:"wc26-e2", group:"Group E", home:"Ivory Coast",  home_zh:"科特迪瓦",away:"Ecuador",       away_zh:"厄瓜多尔",kickoffUtc:"2026-06-14T23:00:00Z", homePool:160, drawPool:110, awayPool:80  },
  { slug:"wc26-e3", group:"Group E", home:"Germany",      home_zh:"德国",    away:"Ivory Coast",   away_zh:"科特迪瓦",kickoffUtc:"2026-06-20T20:00:00Z", homePool:200, drawPool:85,  awayPool:65  },
  { slug:"wc26-e4", group:"Group E", home:"Ecuador",      home_zh:"厄瓜多尔",away:"Curaçao",       away_zh:"库拉索", kickoffUtc:"2026-06-21T00:00:00Z", homePool:220, drawPool:80,  awayPool:50  },
  { slug:"wc26-e5", group:"Group E", home:"Curaçao",      home_zh:"库拉索",  away:"Ivory Coast",   away_zh:"科特迪瓦",kickoffUtc:"2026-06-25T20:00:00Z", homePool:50,  drawPool:90,  awayPool:210 },
  { slug:"wc26-e6", group:"Group E", home:"Ecuador",      home_zh:"厄瓜多尔",away:"Germany",       away_zh:"德国",   kickoffUtc:"2026-06-25T20:00:00Z", homePool:70,  drawPool:90,  awayPool:190 },

  // ────────────────── GROUP F: Japan, Netherlands, Sweden, Tunisia ──
  { slug:"wc26-f1", group:"Group F", home:"Netherlands",  home_zh:"荷兰",    away:"Japan",         away_zh:"日本",   kickoffUtc:"2026-06-14T20:00:00Z", homePool:190, drawPool:85,  awayPool:75  },
  { slug:"wc26-f2", group:"Group F", home:"Sweden",       home_zh:"瑞典",    away:"Tunisia",       away_zh:"突尼斯", kickoffUtc:"2026-06-15T02:00:00Z", homePool:190, drawPool:90,  awayPool:70  },
  { slug:"wc26-f3", group:"Group F", home:"Netherlands",  home_zh:"荷兰",    away:"Sweden",        away_zh:"瑞典",   kickoffUtc:"2026-06-20T17:00:00Z", homePool:170, drawPool:100, awayPool:80  },
  { slug:"wc26-f4", group:"Group F", home:"Tunisia",      home_zh:"突尼斯",  away:"Japan",         away_zh:"日本",   kickoffUtc:"2026-06-21T04:00:00Z", homePool:90,  drawPool:110, awayPool:150 },
  { slug:"wc26-f5", group:"Group F", home:"Tunisia",      home_zh:"突尼斯",  away:"Netherlands",   away_zh:"荷兰",   kickoffUtc:"2026-06-25T23:00:00Z", homePool:60,  drawPool:90,  awayPool:200 },
  { slug:"wc26-f6", group:"Group F", home:"Japan",        home_zh:"日本",    away:"Sweden",        away_zh:"瑞典",   kickoffUtc:"2026-06-25T23:00:00Z", homePool:140, drawPool:110, awayPool:100 },

  // ────────────────── GROUP G: Belgium, Egypt, Iran, New Zealand ──
  { slug:"wc26-g1", group:"Group G", home:"Belgium",      home_zh:"比利时",  away:"Egypt",         away_zh:"埃及",   kickoffUtc:"2026-06-15T19:00:00Z", homePool:210, drawPool:80,  awayPool:60  },
  { slug:"wc26-g2", group:"Group G", home:"Iran",         home_zh:"伊朗",    away:"New Zealand",   away_zh:"新西兰", kickoffUtc:"2026-06-16T01:00:00Z", homePool:170, drawPool:100, awayPool:80  },
  { slug:"wc26-g3", group:"Group G", home:"Belgium",      home_zh:"比利时",  away:"Iran",          away_zh:"伊朗",   kickoffUtc:"2026-06-21T19:00:00Z", homePool:200, drawPool:85,  awayPool:65  },
  { slug:"wc26-g4", group:"Group G", home:"New Zealand",  home_zh:"新西兰",  away:"Egypt",         away_zh:"埃及",   kickoffUtc:"2026-06-22T01:00:00Z", homePool:110, drawPool:120, awayPool:120 },
  { slug:"wc26-g5", group:"Group G", home:"New Zealand",  home_zh:"新西兰",  away:"Belgium",       away_zh:"比利时", kickoffUtc:"2026-06-27T03:00:00Z", homePool:50,  drawPool:80,  awayPool:220 },
  { slug:"wc26-g6", group:"Group G", home:"Egypt",        home_zh:"埃及",    away:"Iran",          away_zh:"伊朗",   kickoffUtc:"2026-06-27T03:00:00Z", homePool:130, drawPool:120, awayPool:100 },

  // ────────────────── GROUP H: Cape Verde, Saudi Arabia, Spain, Uruguay ──
  { slug:"wc26-h1", group:"Group H", home:"Spain",        home_zh:"西班牙",  away:"Cape Verde",    away_zh:"佛得角", kickoffUtc:"2026-06-15T16:00:00Z", homePool:270, drawPool:60,  awayPool:20  },
  { slug:"wc26-h2", group:"Group H", home:"Saudi Arabia", home_zh:"沙特阿拉伯",away:"Uruguay",    away_zh:"乌拉圭", kickoffUtc:"2026-06-15T22:00:00Z", homePool:110, drawPool:110, awayPool:130 },
  { slug:"wc26-h3", group:"Group H", home:"Spain",        home_zh:"西班牙",  away:"Saudi Arabia",  away_zh:"沙特阿拉伯",kickoffUtc:"2026-06-21T16:00:00Z", homePool:240, drawPool:70,  awayPool:40  },
  { slug:"wc26-h4", group:"Group H", home:"Uruguay",      home_zh:"乌拉圭",  away:"Cape Verde",    away_zh:"佛得角", kickoffUtc:"2026-06-21T22:00:00Z", homePool:230, drawPool:75,  awayPool:45  },
  { slug:"wc26-h5", group:"Group H", home:"Cape Verde",   home_zh:"佛得角",  away:"Saudi Arabia",  away_zh:"沙特阿拉伯",kickoffUtc:"2026-06-27T00:00:00Z", homePool:90,  drawPool:110, awayPool:150 },
  { slug:"wc26-h6", group:"Group H", home:"Uruguay",      home_zh:"乌拉圭",  away:"Spain",         away_zh:"西班牙", kickoffUtc:"2026-06-27T00:00:00Z", homePool:100, drawPool:100, awayPool:150 },

  // ────────────────── GROUP I: France, Iraq, Norway, Senegal ──
  { slug:"wc26-i1", group:"Group I", home:"France",       home_zh:"法国",    away:"Senegal",       away_zh:"塞内加尔",kickoffUtc:"2026-06-16T19:00:00Z", homePool:220, drawPool:80,  awayPool:50  },
  { slug:"wc26-i2", group:"Group I", home:"Iraq",         home_zh:"伊拉克",  away:"Norway",        away_zh:"挪威",   kickoffUtc:"2026-06-16T22:00:00Z", homePool:80,  drawPool:110, awayPool:160 },
  { slug:"wc26-i3", group:"Group I", home:"France",       home_zh:"法国",    away:"Iraq",          away_zh:"伊拉克", kickoffUtc:"2026-06-22T21:00:00Z", homePool:270, drawPool:60,  awayPool:20  },
  { slug:"wc26-i4", group:"Group I", home:"Norway",       home_zh:"挪威",    away:"Senegal",       away_zh:"塞内加尔",kickoffUtc:"2026-06-23T00:00:00Z", homePool:160, drawPool:100, awayPool:90  },
  { slug:"wc26-i5", group:"Group I", home:"Norway",       home_zh:"挪威",    away:"France",        away_zh:"法国",   kickoffUtc:"2026-06-26T19:00:00Z", homePool:80,  drawPool:100, awayPool:170 },
  { slug:"wc26-i6", group:"Group I", home:"Senegal",      home_zh:"塞内加尔",away:"Iraq",          away_zh:"伊拉克", kickoffUtc:"2026-06-26T19:00:00Z", homePool:190, drawPool:90,  awayPool:70  },

  // ────────────────── GROUP J: Algeria, Argentina, Austria, Jordan ──
  { slug:"wc26-j1", group:"Group J", home:"Argentina",    home_zh:"阿根廷",  away:"Algeria",       away_zh:"阿尔及利亚",kickoffUtc:"2026-06-17T01:00:00Z", homePool:260, drawPool:65,  awayPool:25  },
  { slug:"wc26-j2", group:"Group J", home:"Austria",      home_zh:"奥地利",  away:"Jordan",        away_zh:"约旦",   kickoffUtc:"2026-06-17T04:00:00Z", homePool:200, drawPool:85,  awayPool:65  },
  { slug:"wc26-j3", group:"Group J", home:"Argentina",    home_zh:"阿根廷",  away:"Austria",       away_zh:"奥地利", kickoffUtc:"2026-06-22T17:00:00Z", homePool:220, drawPool:80,  awayPool:50  },
  { slug:"wc26-j4", group:"Group J", home:"Jordan",       home_zh:"约旦",    away:"Algeria",       away_zh:"阿尔及利亚",kickoffUtc:"2026-06-23T03:00:00Z", homePool:110, drawPool:120, awayPool:120 },
  { slug:"wc26-j5", group:"Group J", home:"Algeria",      home_zh:"阿尔及利亚",away:"Austria",     away_zh:"奥地利", kickoffUtc:"2026-06-28T02:00:00Z", homePool:110, drawPool:110, awayPool:130 },
  { slug:"wc26-j6", group:"Group J", home:"Jordan",       home_zh:"约旦",    away:"Argentina",     away_zh:"阿根廷", kickoffUtc:"2026-06-28T02:00:00Z", homePool:30,  drawPool:70,  awayPool:250 },

  // ────────────────── GROUP K: Colombia, Congo DR, Portugal, Uzbekistan ──
  { slug:"wc26-k1", group:"Group K", home:"Portugal",     home_zh:"葡萄牙",  away:"DR Congo",      away_zh:"刚果金", kickoffUtc:"2026-06-17T17:00:00Z", homePool:230, drawPool:80,  awayPool:40  },
  { slug:"wc26-k2", group:"Group K", home:"Uzbekistan",   home_zh:"乌兹别克斯坦",away:"Colombia",  away_zh:"哥伦比亚",kickoffUtc:"2026-06-18T02:00:00Z", homePool:80,  drawPool:100, awayPool:170 },
  { slug:"wc26-k3", group:"Group K", home:"Portugal",     home_zh:"葡萄牙",  away:"Uzbekistan",    away_zh:"乌兹别克斯坦",kickoffUtc:"2026-06-23T17:00:00Z", homePool:260, drawPool:65,  awayPool:25  },
  { slug:"wc26-k4", group:"Group K", home:"Colombia",     home_zh:"哥伦比亚",away:"DR Congo",      away_zh:"刚果金", kickoffUtc:"2026-06-24T02:00:00Z", homePool:200, drawPool:90,  awayPool:60  },
  { slug:"wc26-k5", group:"Group K", home:"Colombia",     home_zh:"哥伦比亚",away:"Portugal",      away_zh:"葡萄牙", kickoffUtc:"2026-06-27T23:30:00Z", homePool:100, drawPool:100, awayPool:150 },
  { slug:"wc26-k6", group:"Group K", home:"DR Congo",     home_zh:"刚果金",  away:"Uzbekistan",    away_zh:"乌兹别克斯坦",kickoffUtc:"2026-06-27T23:30:00Z", homePool:160, drawPool:100, awayPool:90  },

  // ────────────────── GROUP L: Croatia, England, Ghana, Panama ──
  { slug:"wc26-l1", group:"Group L", home:"England",      home_zh:"英格兰",  away:"Croatia",       away_zh:"克罗地亚",kickoffUtc:"2026-06-17T20:00:00Z", homePool:200, drawPool:85,  awayPool:65  },
  { slug:"wc26-l2", group:"Group L", home:"Ghana",        home_zh:"加纳",    away:"Panama",        away_zh:"巴拿马", kickoffUtc:"2026-06-17T23:00:00Z", homePool:170, drawPool:100, awayPool:80  },
  { slug:"wc26-l3", group:"Group L", home:"England",      home_zh:"英格兰",  away:"Ghana",         away_zh:"加纳",   kickoffUtc:"2026-06-23T20:00:00Z", homePool:210, drawPool:85,  awayPool:55  },
  { slug:"wc26-l4", group:"Group L", home:"Panama",       home_zh:"巴拿马",  away:"Croatia",       away_zh:"克罗地亚",kickoffUtc:"2026-06-23T23:00:00Z", homePool:80,  drawPool:110, awayPool:160 },
  { slug:"wc26-l5", group:"Group L", home:"Panama",       home_zh:"巴拿马",  away:"England",       away_zh:"英格兰", kickoffUtc:"2026-06-27T21:00:00Z", homePool:40,  drawPool:80,  awayPool:230 },
  { slug:"wc26-l6", group:"Group L", home:"Croatia",      home_zh:"克罗地亚",away:"Ghana",         away_zh:"加纳",   kickoffUtc:"2026-06-27T21:00:00Z", homePool:160, drawPool:100, awayPool:90  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const systemAdminId = process.env.SYSTEM_ADMIN_PROFILE_ID;
  if (!systemAdminId) throw new Error("SYSTEM_ADMIN_PROFILE_ID not set in .env.local");

  console.log("──────────────────────────────────────────────");
  console.log(" 2026 World Cup — Real Fixture Market Creator");
  console.log(`  ${FIXTURES.length} markets across Groups A–L`);
  console.log("──────────────────────────────────────────────\n");

  // ── Step 1: Cancel existing wc26-* markets ──────────────────────────────────
  console.log("[1/3] Cleaning up old/incomplete wc26-* markets...");

  // Cancel any active markets with wrong data
  const { data: oldMarkets } = await supabase
    .from("markets")
    .select("id, slug, status")
    .like("slug", "wc26-%")
    .not("status", "in", '("settled","cancelled")');

  if (oldMarkets && oldMarkets.length > 0) {
    console.log(`  Found ${oldMarkets.length} active/pending old markets to cancel.`);
    for (const m of oldMarkets) {
      await supabase.from("markets").update({
        slug:               `old-${m.slug}-${Date.now()}`,
        status:             "cancelled",
        resolution_outcome: "cancelled",
        resolution_notes:   "Replaced by correct 2026 WC fixtures",
      }).eq("id", m.id);
      console.log(`  ✓ Cancelled ${m.slug}`);
    }
  }

  // Also remove any cancelled wc26-* markets that have NO outcomes (from failed previous runs)
  const { data: cancelledEmpty } = await supabase
    .from("markets")
    .select("id, slug")
    .like("slug", "wc26-%")
    .eq("status", "cancelled");

  if (cancelledEmpty && cancelledEmpty.length > 0) {
    // Check which ones have no outcomes
    const { data: withOutcomes } = await supabase
      .from("market_outcomes")
      .select("market_id")
      .in("market_id", cancelledEmpty.map((m) => m.id));

    const withOutcomeIds = new Set((withOutcomes ?? []).map((o) => o.market_id));
    const emptyIds = cancelledEmpty
      .filter((m) => !withOutcomeIds.has(m.id))
      .map((m) => m.id);

    if (emptyIds.length > 0) {
      await supabase.from("markets").delete().in("id", emptyIds);
      console.log(`  ✓ Deleted ${emptyIds.length} empty (no-outcomes) markets from prior failed runs.`);
    }
  }

  // Delete any existing wc26-a1..wc26-l6 slugs (correct slugs that may have been created without outcomes)
  const correctSlugs = FIXTURES.map((f) => f.slug);
  const { data: existingCorrect } = await supabase
    .from("markets")
    .select("id, slug")
    .in("slug", correctSlugs);

  if (existingCorrect && existingCorrect.length > 0) {
    const { data: existingOutcomes } = await supabase
      .from("market_outcomes")
      .select("market_id")
      .in("market_id", existingCorrect.map((m) => m.id));

    const withOutcomeIds = new Set((existingOutcomes ?? []).map((o) => o.market_id));
    const toDelete = existingCorrect.filter((m) => !withOutcomeIds.has(m.id)).map((m) => m.id);

    if (toDelete.length > 0) {
      await supabase.from("markets").delete().in("id", toDelete);
      console.log(`  ✓ Removed ${toDelete.length} half-created markets (no outcomes).`);
    }
  }

  console.log("  Cleanup complete.");

  // ── Step 2: Insert all 72 correct markets ───────────────────────────────────
  console.log("\n[2/3] Creating 72 real fixture markets...\n");

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const fix of FIXTURES) {
    const kickoff     = new Date(fix.kickoffUtc);
    const settleAt    = new Date(kickoff.getTime() + 3 * 60 * 60 * 1000); // +3h
    const isUpcoming  = kickoff > new Date();
    const status      = isUpcoming ? "active" : "closed";

    const { data: market, error: insertErr } = await supabase
      .from("markets")
      .insert({
        slug:           fix.slug,
        market_type:    "multi",
        category:       "Sports",
        status,
        title:          `${fix.home} vs ${fix.away}`,
        title_zh:       `${fix.home_zh} vs ${fix.away_zh}`,
        description:    `2026 FIFA World Cup ${fix.group} — Who wins? Bet on ${fix.home}, Draw, or ${fix.away}.`,
        description_zh: `2026年世界杯${fix.group} — 预测比赛结果：${fix.home_zh}赢、平局，或${fix.away_zh}赢。`,
        question_text:   `${fix.home} vs ${fix.away}: who wins or is it a draw?`,
        question_text_zh:`${fix.home_zh} vs ${fix.away_zh}：谁赢，还是平局？`,
        rules_text:      `Settled on the 90-minute full-time result. Extra time and penalties do not count.`,
        rules_text_zh:   `按90分钟正规时间结果结算，不计加时赛和点球。`,
        close_at:        kickoff.toISOString(),
        cutoff_at:       kickoff.toISOString(),
        settle_at:       settleAt.toISOString(),
        asset_symbol:    "FIFA",
        resolution_outcome: "unresolved",
        created_by:      systemAdminId,
      })
      .select("id")
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        console.log(`  [SKIP] ${fix.slug} already exists.`);
        skipped++;
        continue;
      }
      console.error(`  [FAIL] ${fix.slug}: ${insertErr.message}`);
      failed++;
      continue;
    }

    const marketId = market.id;

    // Insert 3 outcomes: Home Win, Draw, Away Win
    const total = fix.homePool + fix.drawPool + fix.awayPool;
    const { error: outcomesErr } = await supabase.from("market_outcomes").insert([
      { market_id: marketId, slug: "home", label: fix.home,  label_zh: fix.home_zh, pool_amount: fix.homePool, price: parseFloat((fix.homePool / total).toFixed(4)), sort_order: 0 },
      { market_id: marketId, slug: "draw", label: "Draw",    label_zh: "平局",       pool_amount: fix.drawPool, price: parseFloat((fix.drawPool / total).toFixed(4)), sort_order: 1 },
      { market_id: marketId, slug: "away", label: fix.away,  label_zh: fix.away_zh, pool_amount: fix.awayPool, price: parseFloat((fix.awayPool / total).toFixed(4)), sort_order: 2 },
    ]);

    if (outcomesErr) {
      console.error(`  [FAIL] outcomes for ${fix.slug}: ${outcomesErr.message}`);
      failed++;
      continue;
    }

    const kickoffStr = kickoff.toISOString().slice(0, 16).replace("T", " ");
    console.log(`  ✓ ${fix.slug.padEnd(10)} ${fix.group}  ${fix.home} vs ${fix.away}  [${kickoffStr} UTC]`);
    created++;
  }

  // ── Step 3: Summary ──────────────────────────────────────────────────────────
  console.log(`\n[3/3] Done.`);
  console.log(`  Created: ${created}`);
  if (skipped) console.log(`  Skipped: ${skipped} (already existed)`);
  if (failed)  console.log(`  Failed:  ${failed}`);
  console.log(`\nAll 2026 World Cup group stage markets are ready.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
