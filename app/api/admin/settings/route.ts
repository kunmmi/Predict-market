import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = ["market_maker_enabled"] as const;
type SettingKey = (typeof ALLOWED_KEYS)[number];

export async function GET() {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ALLOWED_KEYS);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  const settings = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return NextResponse.json({ success: true, settings });
}

export async function POST(request: Request) {
  let adminProfileId: string;
  try {
    const { profile } = await requireAdminForApi();
    adminProfileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const key: string = body?.key;
  const value: string = body?.value;

  if (!ALLOWED_KEYS.includes(key as SettingKey) || typeof value !== "string") {
    return NextResponse.json({ success: false, message: "Invalid key or value." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  await supabase.from("admin_logs").insert({
    admin_profile_id: adminProfileId,
    action_type: "setting_updated",
    target_table: "platform_settings",
    target_id: key,
    notes: `Set ${key} = ${value}`,
  });

  return NextResponse.json({ success: true });
}
