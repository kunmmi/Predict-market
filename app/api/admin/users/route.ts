import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/users
 * Returns all users, optionally filtered by ?search= (email / display name).
 */
export async function GET(request: Request) {
  try {
    await requireAdminForApi();
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("profiles")
    .select("id, email, display_name, role, kyc_status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (search) {
    // ilike on email OR display_name
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, message: "Failed to load users." }, { status: 500 });
  }

  const users = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      email: string;
      display_name: string | null;
      role: string;
      kyc_status: string;
      created_at: string;
    };
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      role: r.role,
      kycStatus: r.kyc_status,
      createdAt: r.created_at,
    };
  });

  return NextResponse.json({ success: true, users });
}
