import { NextResponse } from "next/server";
import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MinesRevealSchema } from "@/lib/validations/mines";

export async function POST(req: Request) {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  if (!await rateLimit(`mines:${profileId}`, 60, 60_000)) {
    return rateLimitResponse("Too many requests.");
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON." }, { status: 400 });
  }

  const parsed = MinesRevealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.errors[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("reveal_mines_tile", {
    p_profile_id: profileId,
    p_game_id:    parsed.data.game_id,
    p_tile_index: parsed.data.tile_index,
  });

  if (error) {
    console.error("[mines/reveal] RPC error:", error);
    return NextResponse.json({ success: false, message: error.message ?? "Reveal failed." }, { status: 500 });
  }

  const { data: wallet } = await admin
    .from("wallets").select("available_balance").eq("profile_id", profileId).single();

  return NextResponse.json({ success: true, ...(data as object), new_balance: wallet?.available_balance ?? null });
}
