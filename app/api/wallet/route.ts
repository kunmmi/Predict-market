import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/wallet
 * Returns the current user's wallet (balance, available_balance, status).
 */
export async function GET() {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wallets")
    .select("id, balance, available_balance, reserved_balance, status")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { success: false, message: "Wallet not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    wallet: {
      id: data.id,
      balance: String(data.balance),
      availableBalance: String(data.available_balance),
      reservedBalance: String(data.reserved_balance),
      status: data.status,
    },
  });
}
