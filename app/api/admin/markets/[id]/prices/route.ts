import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const priceUpdateSchema = z.object({
  yes_price: z
    .number()
    .min(0.01, "YES price must be at least 0.01")
    .max(0.99, "YES price must be at most 0.99"),
});

type Params = { params: { id: string } };

/**
 * POST /api/admin/markets/[id]/prices
 * Inserts a new market_prices row AND updates the market's yes_price / no_price.
 *
 * Note: The markets table stores yes_price/no_price as a convenience cache;
 * the market_prices table is the canonical price history.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    await requireAdminForApi();
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

  const parsed = priceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const yes_price = Math.round(parsed.data.yes_price * 10000) / 10000;
  const no_price = Math.round((1 - yes_price) * 10000) / 10000;

  const supabase = createSupabaseAdminClient();

  // Insert price history row
  const { error: insertError } = await supabase.from("market_prices").insert({
    market_id: params.id,
    yes_price,
    no_price,
    source: "admin",
  });

  if (insertError) {
    return NextResponse.json(
      { success: false, message: "Failed to insert price record." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, yes_price, no_price }, { status: 201 });
}
