import webpush from "web-push";

// Lazy-initialize VAPID so the module can be imported during the build
// without blowing up when env vars are absent (Next.js page-data collection).
let vapidInitialized = false;
function ensureVapid() {
  if (vapidInitialized) return;
  const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_MAILTO ?? "admin@predictmarket.com";
  if (!pub || !priv) {
    throw new Error("VAPID env vars are not set (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
  }
  webpush.setVapidDetails(`mailto:${mail}`, pub, priv);
  vapidInitialized = true;
}

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
  ensureVapid();
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
