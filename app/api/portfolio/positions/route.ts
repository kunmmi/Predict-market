import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { getPortfolioData } from "@/lib/services/portfolio-data";

/**
 * GET /api/portfolio/positions
 *
 * Returns open positions for the current user.
 * Used by the client-side OpenPositionsLive island for periodic polling.
 */
export async function GET() {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const { openPositions } = await getPortfolioData(profileId);

  return NextResponse.json({ success: true, positions: openPositions }, { status: 200 });
}
