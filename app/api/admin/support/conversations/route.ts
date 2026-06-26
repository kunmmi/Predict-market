/**
 * GET /api/admin/support/conversations
 *
 * Admin inbox: one row per user who has any support messages, with the latest
 * message preview, timestamp, and count of unread (user → admin) messages.
 */

import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Row = {
  profile_id: string;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
  read_by_admin: boolean;
};

export async function GET() {
  let me;
  try {
    me = (await requireUserForApi()).profile;
  } catch {
    return NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
  }
  if (me.role !== "admin") {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  // Most-recent messages first; aggregate per conversation in JS.
  const { data: msgs, error } = await admin
    .from("support_messages")
    .select("profile_id, sender_role, body, created_at, read_by_admin")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ success: false, message: "Failed to load conversations." }, { status: 500 });
  }

  const byProfile = new Map<
    string,
    { lastBody: string; lastAt: string; lastRole: "user" | "admin"; unread: number }
  >();

  for (const m of (msgs ?? []) as Row[]) {
    let entry = byProfile.get(m.profile_id);
    if (!entry) {
      entry = { lastBody: m.body, lastAt: m.created_at, lastRole: m.sender_role, unread: 0 };
      byProfile.set(m.profile_id, entry);
    }
    if (m.sender_role === "user" && !m.read_by_admin) entry.unread += 1;
  }

  const ids = Array.from(byProfile.keys());
  const profilesById = new Map<string, { full_name: string | null; email: string | null }>();
  if (ids.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    for (const p of profiles ?? []) {
      profilesById.set(p.id as string, { full_name: p.full_name as string | null, email: p.email as string | null });
    }
  }

  const conversations = ids
    .map((id) => {
      const c = byProfile.get(id)!;
      const p = profilesById.get(id);
      return {
        profileId: id,
        name: p?.full_name || p?.email || "User",
        email: p?.email ?? null,
        lastBody: c.lastBody,
        lastAt: c.lastAt,
        lastRole: c.lastRole,
        unread: c.unread,
      };
    })
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

  return NextResponse.json({ success: true, conversations });
}
