import { NextResponse } from "next/server";

export async function GET() {
  const requiredEnv = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const;

  const missing = requiredEnv.filter((key) => {
    const value = process.env[key];
    return value == null || value === "";
  });

  return NextResponse.json(
    {
      status: missing.length === 0 ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      missingEnv: missing,
    },
    { status: missing.length === 0 ? 200 : 503 },
  );
}
