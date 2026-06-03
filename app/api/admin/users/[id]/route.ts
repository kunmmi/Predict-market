import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Params = { params: { id: string } };

/**
 * PATCH /api/admin/users/[id]
 * Updates a user's role. Body: { role: "admin" | "user" }
 *
 * Admins cannot demote themselves (prevents accidental lockout).
 */
export async function PATCH(request: Request, { params }: Params) {
  let adminProfile: { id: string; email: string };
  try {
    const { profile } = await requireAdminForApi();
    adminProfile = profile;
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { role?: string } | null;
  const role = body?.role;

  if (role !== "admin" && role !== "user") {
    return NextResponse.json(
      { success: false, message: 'role must be "admin" or "user".' },
      { status: 400 },
    );
  }

  // Prevent self-demotion
  if (params.id === adminProfile.id && role === "user") {
    return NextResponse.json(
      { success: false, message: "You cannot remove your own admin role." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json(
      { success: false, message: "Failed to update user role." },
      { status: 500 },
    );
  }

  await supabase.from("admin_logs").insert({
    admin_profile_id: adminProfile.id,
    action_type: role === "admin" ? "user_promoted_to_admin" : "user_demoted_from_admin",
    target_table: "profiles",
    target_id: params.id,
    notes: `Role set to ${role} by ${adminProfile.email}`,
  });

  return NextResponse.json({ success: true });
}
