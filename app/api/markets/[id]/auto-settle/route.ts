import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { settleShortDurationMarketById } from "@/lib/services/short-duration-settlement";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const result = await settleShortDurationMarketById(params.id);

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json(result, { status: 200 });
}
