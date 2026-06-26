import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminUserDetail } from "@/lib/services/admin-data";

type Params = { params: { id: string } };

/**
 * GET /api/admin/users/[id]
 * Returns full detail for one user — profile, wallet, deposits, withdrawals, trades, positions.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAdminForApi();
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const detail = await getAdminUserDetail(params.id);
  if (!detail) {
    return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...detail });
}

/**
 * DELETE /api/admin/users/[id]
 * Permanently deletes a user from Supabase Auth and all related data.
 *
 * Blocked if:
 *   - Attempting to delete yourself
 *   - The user has a positive wallet balance (withdraw first)
 */
export async function DELETE(_request: Request, { params }: Params) {
  let adminProfile: { id: string; email: string };
  try {
    const { profile } = await requireAdminForApi();
    adminProfile = profile;
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  if (params.id === adminProfile.id) {
    return NextResponse.json(
      { success: false, message: "You cannot delete your own account." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  // Block deletion if user has a positive wallet balance
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("profile_id", params.id)
    .maybeSingle();

  if (wallet && parseFloat(String(wallet.balance ?? "0")) > 0) {
    return NextResponse.json(
      {
        success: false,
        message: `User has a balance of $${parseFloat(String(wallet.balance)).toFixed(2)}. Withdraw or zero out the balance before deleting.`,
      },
      { status: 400 },
    );
  }

  // Fetch profile before deleting (for the audit log)
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", params.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
  }

  // Try to delete from Supabase Auth first (cascades to profiles via FK).
  // If the auth user doesn't exist (e.g. manually-created test accounts), fall
  // through and delete the profile row directly instead.
  const { error: authError } = await supabase.auth.admin.deleteUser(params.id);
  if (authError) {
    const notFound =
      authError.message?.toLowerCase().includes("not found") ||
      authError.message?.toLowerCase().includes("user not found");

    if (!notFound) {
      return NextResponse.json(
        { success: false, message: authError.message ?? "Failed to delete user." },
        { status: 500 },
      );
    }

    // Auth user doesn't exist — delete the profile row directly
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", params.id);

    if (profileError) {
      return NextResponse.json(
        { success: false, message: profileError.message ?? "Failed to delete user profile." },
        { status: 500 },
      );
    }
  }

  await supabase.from("admin_logs").insert({
    admin_profile_id: adminProfile.id,
    action_type: "user_deleted",
    target_table: "profiles",
    target_id: params.id,
    notes: `Deleted user ${profile.email} by ${adminProfile.email}`,
  });

  return NextResponse.json({ success: true });
}

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
