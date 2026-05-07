import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketUpdateSchema } from "@/lib/validations/market";

type Params = { params: { id: string } };

/**
 * PATCH /api/admin/markets/[id]
 * Updates an existing market's editable fields.
 */
export async function PATCH(request: Request, { params }: Params) {
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

  const parsed = marketUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const d = parsed.data;

  let existingDurationMinutes: number | null = null;
  if (d.close_at !== undefined) {
    const { data: existingMarket } = await supabase
      .from("markets")
      .select("duration_minutes")
      .eq("id", params.id)
      .maybeSingle();

    existingDurationMinutes = existingMarket?.duration_minutes ?? null;
  }

  // Build update payload with only defined fields
  const updateData: Record<string, unknown> = {};
  if (d.title !== undefined) updateData.title = d.title;
  if (d.slug !== undefined) updateData.slug = d.slug;
  if (d.description !== undefined) updateData.description = d.description ?? null;
  if (d.category !== undefined) updateData.category = d.category ?? null;
  if (d.asset_symbol !== undefined) updateData.asset_symbol = d.asset_symbol;
  if (d.question_text !== undefined) updateData.question_text = d.question_text;
  if (d.rules_text !== undefined) updateData.rules_text = d.rules_text ?? null;
  if (d.close_at !== undefined) updateData.close_at = d.close_at;
  if (d.close_at !== undefined) {
    updateData.cutoff_at = existingDurationMinutes != null
      ? new Date(new Date(d.close_at).getTime() - 15_000).toISOString()
      : d.close_at;
  }
  if (d.settle_at !== undefined) updateData.settle_at = d.settle_at;
  if (d.status !== undefined) updateData.status = d.status;
  if (d.title_zh !== undefined) updateData.title_zh = d.title_zh ?? null;
  if (d.description_zh !== undefined) updateData.description_zh = d.description_zh ?? null;
  if (d.question_text_zh !== undefined) updateData.question_text_zh = d.question_text_zh ?? null;
  if (d.rules_text_zh !== undefined) updateData.rules_text_zh = d.rules_text_zh ?? null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, message: "No fields provided for update." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("markets")
    .update(updateData)
    .eq("id", params.id);

  if (error) {
    const msg =
      error.code === "23505"
        ? "A market with that slug already exists."
        : "Failed to update market.";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }

  await supabase.from("admin_logs").insert({
    admin_profile_id: adminProfileId,
    action_type: "market_updated",
    target_table: "markets",
    target_id: params.id,
    notes: "Market updated via admin panel",
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
