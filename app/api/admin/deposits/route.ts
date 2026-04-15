import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { getAdminDeposits } from "@/lib/services/admin-data";

/**
 * GET /api/admin/deposits?status=pending|approved|rejected|cancelled|all
 */
export async function GET(request: Request) {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all";

  const deposits = await getAdminDeposits(status);
  return NextResponse.json({ success: true, deposits }, { status: 200 });
}
