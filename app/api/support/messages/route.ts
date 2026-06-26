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

  if (!rateLimit(`support-send:${me.id}`, 20, 60_000)) {
    return rateLimitResponse("You're sending messages too quickly. Please wait a moment.");
  }

  const json = await request.json().catch(() => undefined);
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid message." }, { status: 400 });
  }

  const isAdmin = me.role === "admin";
  const admin = createSupabaseAdminClient();

  // Whose conversation does this message belong to?
  let conversationProfileId: string;
  if (isAdmin) {
    if (!parsed.data.profileId) {
      return NextResponse.json({ success: false, message: "profileId required for admin replies." }, { status: 400 });
    }
    conversationProfileId = parsed.data.profileId;
  } else {
    conversationProfileId = me.id;
  }

  const { data, error } = await admin
    .from("support_messages")
    .insert({
      profile_id: conversationProfileId,
      sender_role: isAdmin ? "admin" : "user",
      sender_profile_id: me.id,
      body: parsed.data.body,
      // The sender has implicitly "read" their own side.
      read_by_admin: isAdmin,
      read_by_user: !isAdmin,
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

  const isAdmin = me.role === "admin";
  const url = new URL(request.url);
  const target = isAdmin ? url.searchParams.get("profileId") : me.id;
  if (!target) {
    return NextResponse.json({ success: false, message: "profileId required." }, { status: 400 });
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
