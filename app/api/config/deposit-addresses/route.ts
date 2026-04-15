import { NextResponse } from "next/server";

import { ASSET_ADDRESS_CONFIG } from "@/lib/config/deposit-addresses";

/**
 * GET /api/config/deposit-addresses
 *
 * Public endpoint — returns the platform receiving address and network label
 * for each supported deposit asset. Only exposes addresses (no secrets).
 *
 * Used by the deposit page client component to display addresses and QR codes.
 */
export async function GET() {
  const addresses = Object.fromEntries(
    Object.entries(ASSET_ADDRESS_CONFIG).map(([asset, cfg]) => [
      asset,
      {
        address: cfg.address,
        networkLabel: cfg.networkLabel,
      },
    ]),
  );

  return NextResponse.json(
    { success: true, addresses },
    {
      status: 200,
      headers: {
        // Addresses change rarely — short cache is fine
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    },
  );
}
