import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/**
 * POST /api/push/subscribe
 * Saves or updates a browser push subscription for the current user.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid subscription." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id:  user.id,
      endpoint: parsed.data.endpoint,
      p256dh:   parsed.data.keys.p256dh,
      auth_key: parsed.data.keys.auth,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

/**
 * DELETE /api/push/subscribe
 * Removes a push subscription (user unsubscribed).
 */
export async function DELETE(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  if (!endpoint) {
    return NextResponse.json({ success: false, message: "Missing endpoint." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  await admin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);

  return NextResponse.json({ success: true }, { status: 200 });
}
