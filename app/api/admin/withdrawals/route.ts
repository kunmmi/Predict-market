import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { getAdminWithdrawals } from "@/lib/services/withdrawal-data";

/**
 * GET /api/admin/withdrawals?status=pending|approved|rejected|cancelled|all
 */
export async function GET(request: Request) {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all";

  const withdrawals = await getAdminWithdrawals(status);
  return NextResponse.json({ success: true, withdrawals }, { status: 200 });
}
