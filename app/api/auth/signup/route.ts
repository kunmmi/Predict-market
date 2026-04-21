import { NextResponse } from "next/server";

import { signupSchema, signupUsernameSchema } from "@/lib/validations/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
  // Strip `mode` from the body before schema validation — both schemas are
  // `.strict()` and would reject any unknown key including `mode` itself.
  // ---------------------------------------------------------------------------
  const { mode: _mode, ...parseable } = body as Record<string, unknown>;

  let email: string;
  let password: string;
  let fullName: string | undefined;
  let promoCode: string | undefined;

  if (mode === "username") {
    const parsed = signupUsernameSchema.safeParse(parseable);
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
    const parsed = signupSchema.safeParse(parseable);
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
  // Create the auth user via the admin client.
  // Using admin.createUser with email_confirm: true bypasses the email
  // confirmation step entirely, so the user can sign in immediately.
  // The on_auth_user_created DB trigger still fires and creates the profile
  // and wallet automatically.
  // ---------------------------------------------------------------------------
  const adminClient = createSupabaseAdminClient();
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "user",
      ...(fullName ? { full_name: fullName } : {}),
    },
  });

  if (createError) {
    // Detect duplicate email/username and surface a readable message
    const msg = createError.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("already exists")) {
      return NextResponse.json(
        {
          success: false,
          message: mode === "username"
            ? "That username is already taken."
            : "An account with this email already exists.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: false, message: createError.message }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Sign in immediately so the session cookie is set and the user lands
  // on /dashboard without being bounced back to /login by middleware.
  // ---------------------------------------------------------------------------
  const supabase = createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    // Account was created but sign-in failed (should be rare).
    // Still a success from the user's perspective — they can log in manually.
    console.error("[signup] auto sign-in failed after account creation:", signInError.message);
  }

  // ---------------------------------------------------------------------------
  // Link referral (non-blocking)
  // ---------------------------------------------------------------------------
  if (validatedPromoCode && createData.user) {
    try {
      await linkReferral(createData.user.id, validatedPromoCode.promoterId, validatedPromoCode.promoCode);
    } catch (referralError) {
      console.error("[signup] referral linkage failed:", referralError);
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
