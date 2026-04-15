import { NextResponse } from "next/server";

import { signupSchema } from "@/lib/validations/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validatePromoCode, linkReferral } from "@/lib/services/referral";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json(
      { success: false, message: "Malformed JSON body." },
      { status: 400 },
    );
  }

  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid signup input.",
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { email, password, fullName, promoCode } = parsed.data;

  // ---------------------------------------------------------------------------
  // If a promo code was provided, validate it before creating the user.
  // This gives the user immediate feedback on a bad code without creating
  // an orphaned account.
  // ---------------------------------------------------------------------------

  let validatedPromoCode: { promoterId: string; promoCode: string } | null = null;

  if (promoCode) {
    const validation = await validatePromoCode(promoCode);

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.message },
        { status: 400 },
      );
    }

    validatedPromoCode = {
      promoterId: validation.promoterId,
      promoCode: validation.promoCode,
    };
  }

  // ---------------------------------------------------------------------------
  // Create the auth user. The on_auth_user_created DB trigger will
  // automatically create the profile and wallet.
  // ---------------------------------------------------------------------------

  const supabase = createSupabaseServerClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "user",
        ...(fullName ? { full_name: fullName } : {}),
      },
    },
  });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------------------------
  // If a valid promo code was provided, link the referral.
  //
  // This is intentionally non-blocking: if referral linkage fails (e.g.
  // service role key not configured, or a transient DB error), the signup
  // still succeeds. The user ends up without a referral, which is better
  // than a failed signup.
  // ---------------------------------------------------------------------------

  if (validatedPromoCode && signUpData.user) {
    try {
      await linkReferral(
        signUpData.user.id,
        validatedPromoCode.promoterId,
        validatedPromoCode.promoCode,
      );
    } catch (referralError) {
      // Log server-side; do not surface to the user.
      console.error("[signup] referral linkage failed:", referralError);
    }
  }

  // Note: depending on Supabase email confirmation settings, the user may
  // not be fully signed-in yet.
  return NextResponse.json({ success: true }, { status: 200 });
}
