import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminCommissions } from "@/lib/services/admin-data";

export async function GET(request: Request) {
  try {
    await requireAdminForApi();
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const commissions = await getAdminCommissions(status);
  return NextResponse.json({ success: true, commissions });
}

export async function PATCH(request: Request) {
  try {
    await requireAdminForApi();
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 401 });
  }

  const body = await request.json().catch(() => undefined);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ success: false, message: "id and status are required." }, { status: 400 });
  }

  const validStatuses = ["pending", "approved", "paid"];
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ success: false, message: "Invalid status." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const updateData: Record<string, unknown> = { status: body.status };
  if (body.status === "approved") updateData.approved_at = new Date().toISOString();
  if (body.status === "paid") updateData.paid_at = new Date().toISOString();

  const { error } = await supabase.from("commissions").update(updateData).eq("id", body.id);
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
