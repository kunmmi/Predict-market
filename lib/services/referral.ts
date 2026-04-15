/**
 * Referral service — promo code validation and referral linkage.
 *
 * Both functions require the Supabase admin client (service role key) to
 * bypass RLS, since:
 *   - looking up a promoter by promo_code is not permitted by the MVP
 *     starter RLS policies for unauthenticated/new users
 *   - writing to profiles.referred_by_promoter_id and referrals requires
 *     elevated access
 *
 * If SUPABASE_SERVICE_ROLE_KEY is not set, validation returns a safe
 * degraded response and linkage is skipped — signup still succeeds.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidatePromoCodeResult =
  | { valid: true; promoterId: string; promoCode: string }
  | { valid: false; promoterId: null; message: string };

// ---------------------------------------------------------------------------
// validatePromoCode
// ---------------------------------------------------------------------------

/**
 * Check whether a promo code exists and belongs to an active promoter.
 *
 * Returns the promoter's internal ID on success so it can be passed
 * directly to linkReferral — avoids a second DB round-trip in the
 * signup route.
 */
export async function validatePromoCode(
  rawCode: string,
): Promise<ValidatePromoCodeResult> {
  const code = rawCode.trim().toUpperCase();

  let adminClient: ReturnType<typeof createSupabaseAdminClient>;
  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    // Service role key not configured — cannot validate server-side.
    return {
      valid: false,
      promoterId: null,
      message: "Promo code validation is temporarily unavailable.",
    };
  }

  const { data, error } = await adminClient
    .from("promoters")
    .select("id, status")
    .eq("promo_code", code)
    .maybeSingle();

  if (error) {
    return {
      valid: false,
      promoterId: null,
      message: "Could not validate promo code.",
    };
  }

  if (!data) {
    return {
      valid: false,
      promoterId: null,
      message: "Promo code not found.",
    };
  }

  if (data.status !== "active") {
    return {
      valid: false,
      promoterId: null,
      message: "This promo code is no longer active.",
    };
  }

  return { valid: true, promoterId: data.id as string, promoCode: code };
}

// ---------------------------------------------------------------------------
// linkReferral
// ---------------------------------------------------------------------------

/**
 * Permanently link a newly signed-up user to a promoter.
 *
 * Two writes happen:
 *   1. profiles.referred_by_promoter_id is set (for reporting/queries)
 *   2. A row is inserted into referrals (the DB trigger only fires on
 *      profiles INSERT, not UPDATE, so we insert manually here)
 *
 * The referrals insert uses ON CONFLICT DO NOTHING (enforced by the
 * unique constraint on referred_profile_id) — safe to call multiple times.
 *
 * @param authUserId   - the auth.users id returned by supabase.auth.signUp()
 * @param promoterId   - the promoters.id from validatePromoCode()
 * @param promoCode    - the normalized code string (for the referrals record)
 */
export async function linkReferral(
  authUserId: string,
  promoterId: string,
  promoCode: string,
): Promise<void> {
  const adminClient = createSupabaseAdminClient();

  // 1. Find the profile that was just created by the on_auth_user_created trigger.
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error(
      `linkReferral: profile not found for auth user ${authUserId}` +
        (profileError ? ` — ${profileError.message}` : ""),
    );
  }

  // 2. Stamp referred_by_promoter_id on the profile.
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ referred_by_promoter_id: promoterId })
    .eq("id", profile.id);

  if (updateError) {
    throw new Error(
      `linkReferral: failed to update profile — ${updateError.message}`,
    );
  }

  // 3. Insert the referral record.
  //    ON CONFLICT DO NOTHING is enforced by the DB constraint on
  //    referred_profile_id, so a duplicate insert is safely ignored.
  const { error: referralError } = await adminClient.from("referrals").insert({
    promoter_id: promoterId,
    referred_profile_id: profile.id,
    promo_code_used: promoCode,
  });

  // Supabase returns a 409 / unique-violation code for duplicates.
  // Treat that as a no-op — the referral already exists.
  if (referralError && referralError.code !== "23505") {
    throw new Error(
      `linkReferral: failed to insert referral — ${referralError.message}`,
    );
  }
}
