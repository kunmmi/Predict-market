import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/get-current-user";

export async function GET() {
  const { user, profile, wallet, error } = await getCurrentUser();

  if (error) {
    return NextResponse.json(
      { success: false, message: error, user: null, profile: null },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { success: true, user, profile, wallet },
    { status: 200 }
  );
}

