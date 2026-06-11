import webpush from "web-push";

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_MAILTO ?? "admin@predictmarket.com"}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export interface PushPayload {
  title: string;
  body: string;
  data?: {
    url?: string;
    marketId?: string;
    [key: string]: unknown;
  };
}

interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export async function sendPushToSubscriptions(
  subs: StoredSubscription[],
  payload: PushPayload,
): Promise<{ expiredIds: string[] }> {
  const expiredIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        const e = err as { statusCode?: number };
        if (e.statusCode === 410 || e.statusCode === 404) {
          expiredIds.push(sub.id);
        }
      }
    }),
  );

  return { expiredIds };
}
