import { NextResponse } from "next/server";

import { loginSchema } from "@/lib/validations/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/** Must match the domain used in the signup route */
const USERNAME_EMAIL_DOMAIN = "elemental.local";

export async function POST(request: Request) {
  // 5 login attempts per minute per IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`login:${ip}`, 5, 60_000)) {
    return rateLimitResponse("Too many login attempts. Please wait a minute and try again.");
  }

  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json({ success: false, message: "Malformed JSON body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid login input.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { identifier, password } = parsed.data;

  // If the identifier looks like an email use it directly,
  // otherwise treat it as a username and construct the virtual email.
  const isEmail = identifier.includes("@");
  const email = isEmail
    ? identifier
    : `${identifier.toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Return a generic message so we don't reveal whether the account exists
    return NextResponse.json(
      { success: false, message: "Invalid credentials. Please check your email/username and password." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
