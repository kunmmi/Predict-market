import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminForApi } from "@/lib/auth/require-admin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPushToSubscriptions } from "@/lib/push/send-push";

export const dynamic = "force-dynamic";

const schema = z.object({
  winner_outcome_id: z.string().uuid(),
  notes: z.string().max(500).optional().nullable(),
});

type Params = { params: { id: string } };

/**
 * POST /api/admin/markets/[id]/settle-multi
 * Settles a multi-outcome market by declaring one outcome the winner.
 * Calls settle_multi_market RPC which atomically:
 *   - marks the winner outcome (is_winner = true)
 *   - pays out winning positions pro-rata from the total pool
 *   - sets market status = 'settled'
 */
export async function POST(request: Request, { params }: Params) {
  let adminProfileId: string;
  try {
    const { profile } = await requireAdminForApi();
    adminProfileId = profile.id;
  } catch {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => undefined);
  if (!body) {
    return NextResponse.json({ success: false, message: "Malformed request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.errors[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  // Confirm market exists and is multi
  const { data: market } = await supabase
    .from("markets")
    .select("market_type, status, title, slug")
    .eq("id", params.id)
    .maybeSingle();

  if (!market) {
    return NextResponse.json({ success: false, message: "Market not found." }, { status: 404 });
  }
  if (market.market_type !== "multi") {
    return NextResponse.json(
      { success: false, message: "Use the standard settle endpoint for binary markets." },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc("settle_multi_market", {
    p_market_id:          params.id,
    p_winner_outcome_id:  parsed.data.winner_outcome_id,
    p_admin_profile_id:   adminProfileId,
    p_notes:              parsed.data.notes ?? null,
  });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message ?? "Settlement failed." },
      { status: 400 },
    );
  }

  // Fire-and-forget: send notifications to all users who had positions in this market
  void sendSettlementNotifications(supabase, params.id, parsed.data.winner_outcome_id, market.title, market.slug ?? "");

  return NextResponse.json({ success: true }, { status: 200 });
}

async function sendSettlementNotifications(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  marketId: string,
  winnerOutcomeId: string,
  marketTitle: string,
  marketSlug: string,
) {
  try {
    // Get all settled positions with their outcome info
    const { data: positions } = await supabase
      .from("positions")
      .select("profile_id, outcome_id, pnl_amount")
      .eq("market_id", marketId)
      .eq("status", "settled")
      .not("outcome_id", "is", null);

    if (!positions || positions.length === 0) return;

    // Get the winner outcome label
    const { data: winnerOutcome } = await supabase
      .from("market_outcomes")
      .select("label")
      .eq("id", winnerOutcomeId)
      .maybeSingle();

    const winnerLabel = winnerOutcome?.label ?? "the winner";
    const marketUrl = `/markets/${marketSlug}`;

    // Build notifications for each position holder
    const notificationRows = positions.map((pos) => {
      const isWinner = pos.outcome_id === winnerOutcomeId;
      const pnl = parseFloat(pos.pnl_amount ?? "0");
      return {
        user_id:   pos.profile_id as string,
        type:      isWinner ? "settlement_win" : "settlement_loss",
        title:     isWinner
          ? `🏆 You won! ${marketTitle}`
          : `⚽ Result in: ${marketTitle}`,
        body:      isWinner
          ? `${winnerLabel} won. You earned $${Math.abs(pnl).toFixed(2)} profit.`
          : `${winnerLabel} won. Better luck next time!`,
        market_id: marketId,
        data:      { url: marketUrl, marketId },
      };
    });

    await supabase.from("notifications").insert(notificationRows);

    // Deduplicate user IDs and get their push subscriptions
    const userIds = Array.from(new Set<string>(positions.map((p) => p.profile_id as string)));
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, user_id")
      .in("user_id", userIds);

    if (!subs || subs.length === 0) return;

    // Group subscriptions by winner/loser for personalised push body
    const winnerUserIdArr = positions
      .filter((p) => p.outcome_id === winnerOutcomeId)
      .map((p) => p.profile_id as string);
    const winnerUserIds = new Set<string>(winnerUserIdArr);

    const winnerSubs = subs.filter((s) => winnerUserIds.has(s.user_id as string));
    const loserSubs  = subs.filter((s) => !winnerUserIds.has(s.user_id as string));

    const pushTasks: Promise<{ expiredIds: string[] }>[] = [];

    if (winnerSubs.length > 0) {
      pushTasks.push(
        sendPushToSubscriptions(winnerSubs, {
          title: `🏆 You won! ${marketTitle}`,
          body:  `${winnerLabel} won. Check your portfolio for your payout.`,
          data:  { url: "/portfolio", marketId },
        }),
      );
    }

    if (loserSubs.length > 0) {
      pushTasks.push(
        sendPushToSubscriptions(loserSubs, {
          title: `⚽ Result in: ${marketTitle}`,
          body:  `${winnerLabel} won. See the result.`,
          data:  { url: marketUrl, marketId },
        }),
      );
    }

    const results = await Promise.all(pushTasks);
    const expiredIds = results.flatMap((r) => r.expiredIds);
    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }
  } catch (e) {
    console.error("[settle-multi] notification send failed:", e);
  }
}
