import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { getAdminUsers } from "@/lib/services/admin-data";

export async function GET() {
  try {
    await requireAdminForApi();
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 401 });
  }

  const users = await getAdminUsers();
  return NextResponse.json({ success: true, users });
}
