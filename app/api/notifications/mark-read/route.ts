import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/mark-read
 * Marks all unread notifications as read for the current user.
 * Optionally pass { ids: string[] } to mark specific ones only.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const specificIds: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;

  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (specificIds && specificIds.length > 0) {
    query = query.in("id", specificIds);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
