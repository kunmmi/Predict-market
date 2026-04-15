import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { getAdminTrades } from "@/lib/services/admin-data";

export async function GET() {
  try {
    await requireAdminForApi();
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 401 });
  }

  const trades = await getAdminTrades();
  return NextResponse.json({ success: true, trades });
}
