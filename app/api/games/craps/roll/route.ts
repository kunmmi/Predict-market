import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CrapsRollSchema } from "@/lib/validations/craps";

export async function POST(req: Request) {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  if (!rateLimit(`craps:${profileId}`, 30, 60_000)) {
    return rateLimitResponse("Too many rolls. Please slow down.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON." }, { status: 400 });
  }

  const parsed = CrapsRollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.errors[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { bets, phase, point_number } = parsed.data;

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.rpc("resolve_craps_round", {
    p_profile_id: profileId,
    p_bets: bets,
    p_phase: phase,
    p_point_number: point_number ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("insufficient") || msg.includes("balance")) {
      return NextResponse.json({ success: false, message: "Insufficient balance." }, { status: 400 });
    }
    console.error("[craps/roll] RPC error:", error);
    return NextResponse.json({ success: false, message: "Roll failed. Please try again." }, { status: 500 });
  }

  // Fetch updated balance to return to client
  const { data: wallet } = await admin
    .from("wallets")
    .select("available_balance")
    .eq("profile_id", profileId)
    .single();

  return NextResponse.json({
    success: true,
    ...(data as object),
    new_balance: wallet?.available_balance ?? null,
  });
}
