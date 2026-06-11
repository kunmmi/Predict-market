/**
 * Create the missing SOL short-duration markets (15min, 30min, 60min).
 * The 5min market already exists — this script creates the other three.
 *
 * Usage:  npx tsx scripts/create-sol-duration-markets.ts
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

const DURATIONS = [15, 30, 60] as const;

async function main() {
  // Fetch the existing 5min SOL market to use as a template
  const { data: template, error } = await supabase
    .from("markets")
    .select("*")
    .eq("asset_symbol", "SOL")
    .eq("duration_minutes", 5)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !template) {
    console.error("Could not find 5min SOL template market:", error?.message);
    process.exit(1);
  }

  console.log(`Template: "${template.title}" [${template.status}] slug=${template.slug}\n`);

  for (const dur of DURATIONS) {
    // Check if one already exists
    const { data: existing } = await supabase
      .from("markets")
      .select("id, slug, status")
      .eq("asset_symbol", "SOL")
      .eq("duration_minutes", dur)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`  [SKIP] ${dur}min already exists → "${existing.slug}" [${existing.status}]`);
      continue;
    }

    const closeAt = new Date(Date.now() + dur * 60 * 1000).toISOString();

    const newMarket = {
      asset_symbol: "SOL",
      title: `Will solana go up in ${dur} mins?`,
      title_zh: `Solana ${dur}分钟内会上涨吗？`,
      slug: `sol-${dur}min-${Date.now()}`,
      description: template.description ?? "",
      category: template.category ?? null,
      question_text: template.question_text ?? null,
      question_text_zh: template.question_text_zh ?? null,
      rules_text: template.rules_text ?? null,
      rules_text_zh: template.rules_text_zh ?? null,
      status: "active",
      duration_minutes: dur,
      close_at: closeAt,
      settle_at: new Date(Date.now() + (dur + 1) * 60 * 1000).toISOString(),
      target_direction: "above",
      created_by: template.created_by,
      cutoff_at: new Date(Date.now() + dur * 60 * 1000).toISOString(),
    };

    const { data: created, error: createErr } = await supabase
      .from("markets")
      .insert(newMarket)
      .select("id, slug")
      .single();

    if (createErr) {
      console.error(`  [FAIL] ${dur}min: ${createErr.message}`);
    } else {
      console.log(`  [OK]   ${dur}min created → id=${created.id} slug=${created.slug}`);
    }
  }

  // Final summary
  const { data: all } = await supabase
    .from("markets")
    .select("duration_minutes, title, status, slug")
    .eq("asset_symbol", "SOL")
    .not("duration_minutes", "is", null)
    .order("duration_minutes");

  console.log("\n=== SOL duration markets now ===");
  for (const m of all ?? []) {
    console.log(`  ${m.duration_minutes}min — "${m.title}" [${m.status}]`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
