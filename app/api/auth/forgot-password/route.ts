import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json({ success: false, message: "Malformed JSON body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.errors[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  // Always return success to avoid leaking whether the email exists
  return NextResponse.json({ success: true }, { status: 200 });
}
