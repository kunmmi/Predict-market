import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { settleShortDurationMarketById } from "@/lib/services/short-duration-settlement";

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  try {
    await requireUserForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const result = await settleShortDurationMarketById(params.id);

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json(result, { status: 200 });
}
