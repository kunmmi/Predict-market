import { NextResponse } from "next/server";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/markets/purge-old-rounds
 *
 * Permanently deletes settled/cancelled short-duration (auto-generated) rounds
 * that are older than `olderThanDays` days.
 *
 * Body: { olderThanDays: number; dryRun?: boolean }
 *
 * Short-duration rounds are identified by: duration_minutes IS NOT NULL.
 * Only rounds with status "settled" or "cancelled" are targeted — active rounds
 * are never touched.
 *
 * Deletion order (explicit, to handle FKs without CASCADE):
 *   market_prices → positions → trades → markets
 *   (limit_orders + anti-gaming table have ON DELETE CASCADE and clean up automatically)
 */
export async function POST(request: Request) {
  let adminProfileId: string;
  try {
    const { profile } = await requireAdminForApi();
    adminProfileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    olderThanDays?: number;
    dryRun?: boolean;
  } | null;

  const olderThanDays = Number(body?.olderThanDays ?? 7);
  const dryRun = body?.dryRun === true;

  if (!Number.isFinite(olderThanDays) || olderThanDays < 1) {
    return NextResponse.json(
      { success: false, message: "olderThanDays must be a positive integer." },
      { status: 400 },
    );
  }

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createSupabaseAdminClient();

  // Find the markets to delete
  const { data: candidates, error: findError } = await supabase
    .from("markets")
    .select("id, title, settle_at")
    .not("duration_minutes", "is", null)   // short-duration rounds only
    .in("status", ["settled", "cancelled"])
    .lt("settle_at", cutoff)
    .order("settle_at", { ascending: false });

  if (findError) {
    console.error("[purge-old-rounds] Error finding candidates:", findError);
    return NextResponse.json(
      { success: false, message: "Failed to query markets." },
      { status: 500 },
    );
  }

  const count = candidates?.length ?? 0;

  // Dry run: just report how many would be deleted
  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      count,
      cutoff,
      message: `${count} short-duration round${count !== 1 ? "s" : ""} older than ${olderThanDays} day${olderThanDays !== 1 ? "s" : ""} would be deleted.`,
    });
  }

  if (count === 0) {
    return NextResponse.json({
      success: true,
      deleted: 0,
      message: "No rounds matched the criteria — nothing to delete.",
    });
  }

  const ids = (candidates ?? []).map((m) => m.id);

  // Delete child rows in dependency order to avoid FK violations
  const steps: Array<{ table: string; column?: string }> = [
    { table: "market_prices" },
    { table: "positions" },
    { table: "trades" },
  ];

  for (const { table } of steps) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in("market_id", ids);

    if (error) {
      // Non-fatal: some tables may not have all market IDs — log and continue
      console.warn(`[purge-old-rounds] Partial error deleting from ${table}:`, error.message);
    }
  }

  // Now delete the markets themselves
  const { error: deleteError } = await supabase
    .from("markets")
    .delete()
    .in("id", ids);

  if (deleteError) {
    console.error("[purge-old-rounds] Error deleting markets:", deleteError);
    return NextResponse.json(
      { success: false, message: `Failed to delete markets: ${deleteError.message}` },
      { status: 500 },
    );
  }

  // Audit log
  await supabase.from("admin_logs").insert({
    admin_profile_id: adminProfileId,
    action_type: "markets_purged",
    target_table: "markets",
    target_id: "bulk",
    notes: `Purged ${count} short-duration rounds older than ${olderThanDays} days (cutoff: ${cutoff})`,
  });

  return NextResponse.json({
    success: true,
    deleted: count,
    message: `${count} old round${count !== 1 ? "s" : ""} deleted successfully.`,
  });
}
