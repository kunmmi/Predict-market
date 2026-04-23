import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { insertInitialMarketPrice } from "@/lib/services/market-initial-prices";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAllMarketsAdmin } from "@/lib/services/market-data";
import { marketCreateSchema } from "@/lib/validations/market";

/**
 * GET /api/admin/markets
 * Returns all markets for the admin.
 */
export async function GET() {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const markets = await getAllMarketsAdmin();
  return NextResponse.json({ success: true, markets }, { status: 200 });
}

/**
 * POST /api/admin/markets
 * Creates a new market.
 */
export async function POST(request: Request) {
  let adminProfileId: string;
  try {
    const { profile } = await requireAdminForApi();
    adminProfileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json(
      { success: false, message: "Malformed JSON body." },
      { status: 400 },
    );
  }

  const parsed = marketCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    title,
    slug,
    description,
    category,
    asset_symbol,
    question_text,
    rules_text,
    close_at,
    settle_at,
    status,
    title_zh,
    description_zh,
    question_text_zh,
    rules_text_zh,
  } = parsed.data;

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("markets")
    .insert({
      title,
      slug,
      description: description ?? null,
      category: category ?? null,
      asset_symbol,
      question_text,
      rules_text: rules_text ?? null,
      close_at,
      settle_at,
      status: status ?? "draft",
      created_by: adminProfileId,
      resolution_outcome: "unresolved",
      title_zh: title_zh ?? null,
      description_zh: description_zh ?? null,
      question_text_zh: question_text_zh ?? null,
      rules_text_zh: rules_text_zh ?? null,
    })
    .select("id, slug")
    .single();

  if (error) {
    const msg =
      error.code === "23505"
        ? "A market with that slug already exists."
        : "Failed to create market.";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }

  try {
    await insertInitialMarketPrice(data.id);
  } catch (priceError) {
    const message =
      priceError instanceof Error ? priceError.message : "Failed to create initial market price.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 },
    );
  }

  // Log admin action
  await supabase.from("admin_logs").insert({
    admin_profile_id: adminProfileId,
    action_type: "market_created",
    target_table: "markets",
    target_id: data.id,
    notes: `Created market: ${title}`,
  });

  return NextResponse.json({ success: true, marketId: data.id, slug: data.slug }, { status: 201 });
}
