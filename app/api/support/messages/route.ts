/**
 * Support chat messages.
 *
 *   POST /api/support/messages   — send a message (role inferred from session)
 *   GET  /api/support/messages   — fetch a thread (own thread for users;
 *                                   ?profileId=… for admins)
 *
 * Sends always go through this route so the server sets profile_id / sender_role
 * / sender_profile_id authoritatively — clients can't spoof who they are.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  // Required when an admin replies; ignored for users (they message their own thread).
  profileId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  let me;
  try {
    me = (await requireUserForApi()).profile;
  } catch {
    return NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
  }

  if (!await rateLimit(`support-send:${me.id}`, 20, 60_000)) {
    return rateLimitResponse("You're sending messages too quickly. Please wait a moment.");
  }

  const json = await request.json().catch(() => undefined);
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid message." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // The conversation defaults to the sender's own thread. Role is decided by
  // ownership, NOT the viewer's global role — so an admin posting on their own
  // /support page is a "user" in their own thread, and only when posting to
  // SOMEONE ELSE's thread are they acting as an "admin" (which requires the
  // admin role).
  const conversationProfileId = parsed.data.profileId ?? me.id;
  const senderIsOwner = conversationProfileId === me.id;
  if (!senderIsOwner && me.role !== "admin") {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }
  const senderRole: "user" | "admin" = senderIsOwner ? "user" : "admin";

  const { data, error } = await admin
    .from("support_messages")
    .insert({
      profile_id: conversationProfileId,
      sender_role: senderRole,
      sender_profile_id: me.id,
      body: parsed.data.body,
      // The sender has implicitly "read" their own side.
      read_by_admin: senderRole === "admin",
      read_by_user: senderRole === "user",
    })
    .select("id, profile_id, sender_role, sender_profile_id, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: "Failed to send message." }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: data }, { status: 201 });
}

export async function GET(request: Request) {
  let me;
  try {
    me = (await requireUserForApi()).profile;
  } catch {
    return NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("profileId") ?? me.id;
  // Own thread is always allowed; another user's thread requires admin.
  if (target !== me.id && me.role !== "admin") {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("support_messages")
    .select("id, profile_id, sender_role, sender_profile_id, body, created_at")
    .eq("profile_id", target)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ success: false, message: "Failed to load messages." }, { status: 500 });
  }

  return NextResponse.json({ success: true, messages: data ?? [] });
}
