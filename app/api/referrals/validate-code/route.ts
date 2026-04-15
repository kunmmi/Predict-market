import { NextResponse } from "next/server";

import { validatePromoCode } from "@/lib/services/referral";

/**
 * GET /api/referrals/validate-code?code=YOURCODE
 *
 * Used by the signup form for live promo-code validation.
 * Returns whether the code exists and belongs to an active promoter.
 *
 * Does NOT require authentication — this endpoint is intentionally public
 * so unauthenticated users can validate a code before signing up.
 *
 * Response shape:
 *   { valid: true }
 *   { valid: false, message: string }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") ?? "";

  if (code.trim() === "") {
    return NextResponse.json(
      { valid: false, message: "No code provided." },
      { status: 400 },
    );
  }

  const result = await validatePromoCode(code);

  if (!result.valid) {
    return NextResponse.json(
      { valid: false, message: result.message },
      { status: 200 },
    );
  }

  // Return only valid: true — do not expose the promoter ID to the client.
  return NextResponse.json({ valid: true }, { status: 200 });
}
