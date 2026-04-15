import { NextResponse } from "next/server";

import { requireUserForApi } from "@/lib/auth/require-user-for-api";
import { getPromoterSummaryByProfileId } from "@/lib/services/promoter-data";

export async function GET() {
  let profileId: string;
  try {
    const { profile } = await requireUserForApi();
    profileId = profile.id;
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 401 },
    );
  }

  const summary = await getPromoterSummaryByProfileId(profileId);

  if (!summary) {
    return NextResponse.json(
      { error: "Promoter profile not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ promoter: summary });
}
