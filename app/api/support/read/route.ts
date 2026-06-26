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

  const isAdmin = me.role === "admin";
  const admin = createSupabaseAdminClient();

  if (isAdmin) {
    if (!parsed.data.profileId) {
      return NextResponse.json({ success: false, message: "profileId required." }, { status: 400 });
    }
    await admin
      .from("support_messages")
      .update({ read_by_admin: true })
      .eq("profile_id", parsed.data.profileId)
      .eq("sender_role", "user")
      .eq("read_by_admin", false);
  } else {
    await admin
      .from("support_messages")
      .update({ read_by_user: true })
      .eq("profile_id", me.id)
      .eq("sender_role", "admin")
      .eq("read_by_user", false);
  }

  return NextResponse.json({ success: true });
}
