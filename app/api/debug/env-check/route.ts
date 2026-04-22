import { NextResponse } from "next/server";

/**
 * Temporary debug endpoint — checks which env vars are present (never exposes values).
 * DELETE THIS FILE after debugging.
 */
export async function GET() {
  const vars = [
    "TATUM_API_KEY",
    "WALLET_PRIVATE_KEY_ETH",
    "WALLET_PRIVATE_KEY_SOL",
    "SYSTEM_ADMIN_PROFILE_ID",
    "NEXT_PUBLIC_APP_URL",
    "DEPOSIT_ADDRESS_BSC",
  ];

  const result = Object.fromEntries(
    vars.map((key) => [key, !!process.env[key]])
  );

  return NextResponse.json(result);
}
