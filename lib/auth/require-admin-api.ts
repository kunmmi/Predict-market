import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/get-current-user";

/**
 * API-route-safe admin check.
 *
 * Unlike `requireAdmin()` (which calls `redirect()`), this function
 * throws a plain Error so it can be used inside try/catch in Route Handlers
 * without the redirect being swallowed.
 *
 * Usage:
 *   try {
 *     await requireAdminForApi();
 *   } catch (e) {
 *     return NextResponse.json({ success: false, message: (e as Error).message }, { status: 401 });
 *   }
 */
export async function requireAdminForApi(): Promise<{ profile: CurrentProfile }> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("Profile not found.");
  }

  if ((profile as CurrentProfile).role !== "admin") {
    throw new Error("Forbidden.");
  }

  return { profile: profile as CurrentProfile };
}
