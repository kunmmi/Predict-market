/**
 * DELETE /api/limit-orders/[id]
 *
 * Cancels an open limit order and refunds reserved funds.
 */

import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: success, error } = await supabase.rpc("cancel_limit_order", {
    p_order_id: params.id,
    p_profile_id: profileId,
    p_reason: "user_cancelled",
  });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message ?? "Failed to cancel order" },
      { status: 400 },
    );
  }
  if (!success) {
    return NextResponse.json(
      { success: false, message: "Order is not open or does not exist" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
