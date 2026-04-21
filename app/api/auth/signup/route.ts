import { NextResponse } from "next/server";

import { signupSchema, signupUsernameSchema } from "@/lib/validations/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validatePromoCode, linkReferral } from "@/lib/services/referral";

/** Virtual email domain used for username-only accounts. Never exposed to users. */
const USERNAME_EMAIL_DOMAIN = "elemental.local";

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json({ success: false, message: "Malformed JSON body." }, { status: 400 });
  }

  const mode = body?.mode === "username" ? "username" : "email";

  // ---------------------------------------------------------------------------
  // Parse and validate input based on signup mode
  // ---------------------------------------------------------------------------
  let email: string;
  let password: string;
  let fullName: string | undefined;
  let promoCode: string | undefined;

  if (mode === "username") {
    const parsed = signupUsernameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.errors[0]?.message ?? "Invalid input.", errors: parsed.error.flatten() },
        { status: 400 },
      );
    }
    // Generate a deterministic virtual email from the username
    email = `${parsed.data.username.toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
    password = parsed.data.password;
    fullName = parsed.data.username; // store username as display name
    promoCode = parsed.data.promoCode;
  } else {
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid signup input.", errors: parsed.error.flatten() },
        { status: 400 },
      );
    }
    email = parsed.data.email;
    password = parsed.data.password;
    fullName = parsed.data.fullName;
    promoCode = parsed.data.promoCode;
  }

  // ---------------------------------------------------------------------------
  // Validate promo code before creating the user
  // ---------------------------------------------------------------------------
  let validatedPromoCode: { promoterId: string; promoCode: string } | null = null;

  if (promoCode) {
    const validation = await validatePromoCode(promoCode);
    if (!validation.valid) {
      return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
    }
    validatedPromoCode = { promoterId: validation.promoterId, promoCode: validation.promoCode };
  }

  // ---------------------------------------------------------------------------
  // Create the auth user in Supabase
  // The on_auth_user_created DB trigger creates the profile and wallet.
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
    // Make username conflict errors readable
    if (error.message.toLowerCase().includes("already registered")) {
      return NextResponse.json(
        { success: false, message: mode === "username" ? "That username is already taken." : "An account with this email already exists." },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Link referral (non-blocking)
  // ---------------------------------------------------------------------------
  if (validatedPromoCode && signUpData.user) {
    try {
      await linkReferral(signUpData.user.id, validatedPromoCode.promoterId, validatedPromoCode.promoCode);
    } catch (referralError) {
      console.error("[signup] referral linkage failed:", referralError);
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
