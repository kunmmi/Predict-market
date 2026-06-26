/**
 * POST /api/support/read
 *
 * Marks the other party's messages in a conversation as read.
 *   - User:  marks all admin messages in their own thread read_by_user = true
 *   - Admin: marks all user messages in conversation `profileId` read_by_admin = true
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({ profileId: z.string().uuid().optional() });

export async function POST(request: Request) {
  let me;
  try {
    me = (await requireUserForApi()).profile;
  } catch {
    return NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid input." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const target = parsed.data.profileId ?? me.id;
  const viewingOwnThread = target === me.id;
  if (!viewingOwnThread && me.role !== "admin") {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  if (viewingOwnThread) {
    // The user is reading their own thread → mark admin messages read.
    await admin
      .from("support_messages")
      .update({ read_by_user: true })
      .eq("profile_id", me.id)
      .eq("sender_role", "admin")
      .eq("read_by_user", false);
  } else {
    // An admin is reading a user's thread → mark user messages read.
    await admin
      .from("support_messages")
      .update({ read_by_admin: true })
      .eq("profile_id", target)
      .eq("sender_role", "user")
      .eq("read_by_admin", false);
  }

  return NextResponse.json({ success: true });
}
