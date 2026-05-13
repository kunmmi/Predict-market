import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrAssignDepositAddress } from "@/lib/services/deposit-address";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
  }

  try {
    const address = await getOrAssignDepositAddress(profile.id);
    return NextResponse.json({ success: true, address });
  } catch (err) {
    console.error("[deposit-address] Failed to get/assign address:", err);
    return NextResponse.json(
      { success: false, message: "Could not generate deposit address." },
      { status: 500 },
    );
  }
}
