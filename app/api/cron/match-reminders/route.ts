import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPushToSubscriptions } from "@/lib/push/send-push";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/match-reminders
 * Vercel cron — runs every 30 minutes.
 * Sends "match starting soon" push notifications to users with open positions
 * in markets closing within 35 minutes.
 */
export async function GET(request: Request) {
  // Verify cron secret so random callers can't trigger it
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 35 * 60 * 1000);

  // Find active multi markets closing within the next 35 minutes
  const { data: markets } = await supabase
    .from("markets")
    .select("id, title, title_zh, slug")
    .eq("status", "active")
    .eq("market_type", "multi")
    .gte("close_at", now.toISOString())
    .lte("close_at", windowEnd.toISOString());

  if (!markets || markets.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  let totalSent = 0;

  for (const market of markets) {
    // Find users with open positions in this market who haven't been reminded yet
    const { data: positions } = await supabase
      .from("positions")
      .select("profile_id")
      .eq("market_id", market.id)
      .eq("status", "open");

    if (!positions || positions.length === 0) continue;

    const userIds = Array.from(new Set<string>(positions.map((p) => p.profile_id as string)));

    // Skip users already notified about this match
    const { data: alreadyNotified } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("market_id", market.id)
      .eq("type", "match_reminder")
      .gte("created_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString());

    const alreadyNotifiedSet = new Set((alreadyNotified ?? []).map((n) => n.user_id as string));
    const toNotify = userIds.filter((id) => !alreadyNotifiedSet.has(id));

    if (toNotify.length === 0) continue;

    const title = `⚽ Match starting soon`;
    const body = `${market.title} kicks off in ~30 minutes. Your position is active.`;

    // Insert in-app notifications
    await supabase.from("notifications").insert(
      toNotify.map((userId) => ({
        user_id:   userId,
        type:      "match_reminder",
        title,
        body,
        market_id: market.id,
        data:      { url: `/markets/${market.slug}`, marketId: market.id },
      })),
    );

    // Get push subscriptions for these users
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .in("user_id", toNotify);

    if (subs && subs.length > 0) {
      const { expiredIds } = await sendPushToSubscriptions(subs, {
        title,
        body,
        data: { url: `/markets/${market.slug}`, marketId: market.id },
      });

      // Clean up expired subscriptions
      if (expiredIds.length > 0) {
        await supabase.from("push_subscriptions").delete().in("id", expiredIds);
      }

      totalSent += subs.length - expiredIds.length;
    }
  }

  return NextResponse.json({ success: true, sent: totalSent, markets: markets.length });
}
