import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CrashPlaySchema } from "@/lib/validations/crash";

export async function POST(req: Request) {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  if (!rateLimit(`crash:${profileId}`, 30, 60_000)) {
    return rateLimitResponse("Too many plays. Please slow down.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON." }, { status: 400 });
  }

  const parsed = CrashPlaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.errors[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { bet_amount, auto_cashout } = parsed.data;

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.rpc("resolve_crash_round", {
    p_profile_id:  profileId,
    p_bet_amount:  bet_amount,
    p_auto_cashout: auto_cashout,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("insufficient") || msg.includes("balance")) {
      return NextResponse.json({ success: false, message: "Insufficient balance." }, { status: 400 });
    }
    console.error("[crash/play] RPC error:", error);
    return NextResponse.json({ success: false, message: "Play failed. Please try again." }, { status: 500 });
  }

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
