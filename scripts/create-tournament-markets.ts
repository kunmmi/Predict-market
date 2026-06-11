/**
 * Seed the three WC 2026 tournament-level multi-outcome markets:
 *   1. Golden Boot (top scorer)
 *   2. Most Assists
 *   3. Golden Glove (best goalkeeper)
 *
 * Usage:  npx tsx scripts/create-tournament-markets.ts
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

// Tournament closes / settles after the final
const CLOSE_AT  = "2026-07-19T22:00:00Z"; // Final kick-off
const SETTLE_AT = "2026-07-21T00:00:00Z"; // 2 days after final

// Reference admin profile from existing FIFA markets
async function getAdminProfileId(): Promise<string> {
  const { data } = await supabase
    .from("markets")
    .select("created_by")
    .eq("asset_symbol", "FIFA")
    .limit(1)
    .single();
  if (!data?.created_by) throw new Error("No FIFA market found — cannot infer admin profile id");
  return data.created_by as string;
}

type Outcome = { label: string; label_zh: string; slug: string };

const GOLDEN_BOOT_PLAYERS: Outcome[] = [
  { label: "Kylian Mbappé",       label_zh: "基利安·姆巴佩",     slug: "mbappe" },
  { label: "Erling Haaland",      label_zh: "厄林·哈兰德",       slug: "haaland" },
  { label: "Vinicius Jr",         label_zh: "维尼修斯",          slug: "vinicius" },
  { label: "Cristiano Ronaldo",   label_zh: "克里斯蒂亚诺·罗纳尔多", slug: "ronaldo" },
  { label: "Lionel Messi",        label_zh: "莱昂内尔·梅西",     slug: "messi" },
  { label: "Harry Kane",          label_zh: "哈里·凯恩",         slug: "kane" },
  { label: "Lautaro Martínez",    label_zh: "劳塔罗·马丁内斯",   slug: "lautaro" },
  { label: "Bukayo Saka",         label_zh: "布卡约·萨卡",       slug: "saka" },
  { label: "Phil Foden",          label_zh: "菲尔·福登",         slug: "foden" },
  { label: "Antoine Griezmann",   label_zh: "安托万·格里兹曼",   slug: "griezmann" },
  { label: "Neymar Jr",           label_zh: "内马尔",            slug: "neymar" },
  { label: "Cody Gakpo",          label_zh: "科迪·加克波",       slug: "gakpo" },
  { label: "Christian Pulisic",   label_zh: "克里斯蒂安·普利西奇", slug: "pulisic" },
  { label: "Memphis Depay",       label_zh: "孟菲斯·德佩",       slug: "depay" },
  { label: "Marcus Rashford",     label_zh: "马库斯·拉什福德",   slug: "rashford" },
  { label: "Pedri",               label_zh: "佩德里",            slug: "pedri" },
  { label: "Ferran Torres",       label_zh: "费兰·托雷斯",       slug: "ferran" },
  { label: "Other",               label_zh: "其他球员",          slug: "other" },
];

const MOST_ASSISTS_PLAYERS: Outcome[] = [
  { label: "Kylian Mbappé",       label_zh: "基利安·姆巴佩",     slug: "mbappe" },
  { label: "Lionel Messi",        label_zh: "莱昂内尔·梅西",     slug: "messi" },
  { label: "Vinicius Jr",         label_zh: "维尼修斯",          slug: "vinicius" },
  { label: "Bukayo Saka",         label_zh: "布卡约·萨卡",       slug: "saka" },
  { label: "Phil Foden",          label_zh: "菲尔·福登",         slug: "foden" },
  { label: "Pedri",               label_zh: "佩德里",            slug: "pedri" },
  { label: "Antoine Griezmann",   label_zh: "安托万·格里兹曼",   slug: "griezmann" },
  { label: "Christian Pulisic",   label_zh: "克里斯蒂安·普利西奇", slug: "pulisic" },
  { label: "Jude Bellingham",     label_zh: "贾德·贝林厄姆",     slug: "bellingham" },
  { label: "Kevin De Bruyne",     label_zh: "凯文·德布劳内",     slug: "de-bruyne" },
  { label: "Gavi",                label_zh: "加维",              slug: "gavi" },
  { label: "Daichi Kamada",       label_zh: "镰田大地",          slug: "kamada" },
  { label: "Other",               label_zh: "其他球员",          slug: "other" },
];

const GOLDEN_GLOVE_GOALKEEPERS: Outcome[] = [
  { label: "Alisson Becker",      label_zh: "阿利松",            slug: "alisson" },
  { label: "Mike Maignan",        label_zh: "迈克·迈尼昂",       slug: "maignan" },
  { label: "Jordan Pickford",     label_zh: "乔丹·皮克福德",     slug: "pickford" },
  { label: "Unai Simón",          label_zh: "乌纳伊·西蒙",       slug: "simon" },
  { label: "Diogo Costa",         label_zh: "迪奥戈·科斯塔",     slug: "costa" },
  { label: "Manuel Neuer",        label_zh: "曼努埃尔·诺伊尔",   slug: "neuer" },
  { label: "Thibaut Courtois",    label_zh: "蒂博·科尔图瓦",     slug: "courtois" },
  { label: "Matt Turner",         label_zh: "马特·特纳",         slug: "turner" },
  { label: "Other",               label_zh: "其他门将",          slug: "other" },
];

const MARKETS = [
  {
    slug: "wc-2026-golden-boot",
    title: "Who will win the 2026 FIFA World Cup Golden Boot?",
    title_zh: "谁将赢得2026年世界杯金靴奖？",
    description: "The Golden Boot is awarded to the player who scores the most goals at the 2026 FIFA World Cup. In case of a tie, assists and then minutes played are used as tiebreakers.",
    description_zh: "金靴奖颁发给2026年世界杯射入最多进球的球员。若平局，则以助攻数和上场时间作为决胜标准。",
    question_text: "Which player will score the most goals at the 2026 FIFA World Cup?",
    question_text_zh: "哪位球员将在2026年世界杯上射入最多进球？",
    rules_text: "Market resolves to the player officially awarded the Golden Boot by FIFA at the end of the tournament. If the awarded player is not listed as an outcome, resolves to 'Other'.",
    rules_text_zh: "市场将解析为FIFA在锦标赛结束时正式颁发金靴奖的球员。如果获奖球员未列为结果，则解析为'其他球员'。",
    outcomes: GOLDEN_BOOT_PLAYERS,
  },
  {
    slug: "wc-2026-most-assists",
    title: "Who will have the most assists at the 2026 FIFA World Cup?",
    title_zh: "谁将在2026年世界杯上送出最多助攻？",
    description: "Predict which player will record the most assists (qualifying passes leading directly to goals) throughout the entire 2026 FIFA World Cup tournament.",
    description_zh: "预测哪位球员将在整个2026年世界杯赛事中送出最多助攻（直接导致进球的关键传球）。",
    question_text: "Which player will record the most assists at the 2026 FIFA World Cup?",
    question_text_zh: "哪位球员将在2026年世界杯上送出最多助攻？",
    rules_text: "Market resolves to the player with the most official assists per FIFA statistics at the end of the tournament. Tiebreakers: fewest minutes played. If not listed, resolves to 'Other'.",
    rules_text_zh: "市场将解析为锦标赛结束时根据FIFA统计数据助攻最多的球员。决胜标准：上场时间最少。如果未列出，则解析为'其他球员'。",
    outcomes: MOST_ASSISTS_PLAYERS,
  },
  {
    slug: "wc-2026-golden-glove",
    title: "Who will win the 2026 FIFA World Cup Golden Glove?",
    title_zh: "谁将赢得2026年世界杯最佳门将奖？",
    description: "The Golden Glove is awarded to the best goalkeeper at the 2026 FIFA World Cup, as selected by FIFA's technical committee.",
    description_zh: "最佳门将奖颁发给2026年世界杯上表现最佳的门将，由FIFA技术委员会评选。",
    question_text: "Which goalkeeper will be awarded the Golden Glove at the 2026 FIFA World Cup?",
    question_text_zh: "哪位门将将荣获2026年世界杯最佳门将奖？",
    rules_text: "Market resolves to the goalkeeper officially awarded the Golden Glove by FIFA. If not listed, resolves to 'Other'.",
    rules_text_zh: "市场将解析为FIFA正式颁发最佳门将奖的门将。如果未列出，则解析为'其他门将'。",
    outcomes: GOLDEN_GLOVE_GOALKEEPERS,
  },
];

async function main() {
  const adminId = await getAdminProfileId();
  console.log(`Using admin profile: ${adminId}\n`);

  for (const m of MARKETS) {
    // Check if already exists
    const { data: existing } = await supabase
      .from("markets")
      .select("id, slug")
      .eq("slug", m.slug)
      .maybeSingle();

    if (existing) {
      console.log(`[SKIP] "${m.slug}" already exists`);
      continue;
    }

    // Create the market
    const { data: market, error: mErr } = await supabase
      .from("markets")
      .insert({
        slug: m.slug,
        title: m.title,
        title_zh: m.title_zh,
        description: m.description,
        description_zh: m.description_zh,
        question_text: m.question_text,
        question_text_zh: m.question_text_zh,
        rules_text: m.rules_text,
        rules_text_zh: m.rules_text_zh,
        asset_symbol: "FIFA",
        market_type: "multi",
        status: "active",
        close_at: CLOSE_AT,
        settle_at: SETTLE_AT,
        cutoff_at: CLOSE_AT,
        created_by: adminId,
      })
      .select("id")
      .single();

    if (mErr || !market) {
      console.error(`[FAIL] "${m.slug}": ${mErr?.message}`);
      continue;
    }

    // Insert outcomes — equal starting price distributed evenly
    const startPrice = parseFloat((1 / m.outcomes.length).toFixed(4));
    const outcomeRows = m.outcomes.map((o, i) => ({
      market_id: market.id,
      label: o.label,
      label_zh: o.label_zh,
      slug: o.slug,
      price: startPrice,
      pool_amount: 0,
      sort_order: i,
    }));

    const { error: oErr } = await supabase.from("market_outcomes").insert(outcomeRows);
    if (oErr) {
      console.error(`[FAIL] outcomes for "${m.slug}": ${oErr.message}`);
      continue;
    }

    console.log(`[OK]  "${m.slug}" — ${m.outcomes.length} outcomes (id: ${market.id})`);
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
