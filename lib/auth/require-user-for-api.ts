import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/get-current-user";

/**
 * API-route-safe user auth check.
 *
 * Unlike `requireUser()` (which calls `redirect()`), this function
 * throws a plain Error so it can be safely used inside try/catch in
 * Route Handlers without the NEXT_REDIRECT error being swallowed and
 * mis-reported as a 401.
 *
 * Usage:
 *   let profileId: string;
 *   try {
 *     const { profile } = await requireUserForApi();
 *     profileId = profile.id;
 *   } catch (e) {
 *     return NextResponse.json({ success: false, message: (e as Error).message }, { status: 401 });
 *   }
 */
export async function requireUserForApi(): Promise<{ profile: CurrentProfile }> {
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

  return { profile: profile as CurrentProfile };
}
