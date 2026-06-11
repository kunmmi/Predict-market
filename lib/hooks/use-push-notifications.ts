"use client";

import { useEffect, useState, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const charCodes: number[] = [];
  for (let i = 0; i < rawData.length; i++) charCodes.push(rawData.charCodeAt(i));
  return new Uint8Array(charCodes);
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [swReady, setSwReady] = useState(false);

  // Register service worker once on mount
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => setSwReady(true))
      .catch(console.error);
  }, []);

  // Read current permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const doSubscribe = useCallback(async () => {
    if (!swReady || !("PushManager" in window)) return;

    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          ),
        }));

      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subJson),
      });

      setSubscribed(true);
    } catch (e) {
      console.error("Push subscription failed:", e);
    } finally {
      setLoading(false);
    }
  }, [swReady]);

  // Auto-subscribe if permission is already granted
  useEffect(() => {
    if (permission === "granted" && swReady && !subscribed) {
      doSubscribe();
    }
  }, [permission, swReady, subscribed, doSubscribe]);

  const requestAndSubscribe = useCallback(async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      await doSubscribe();
    }
  }, [doSubscribe]);

  return { permission, subscribed, loading, requestAndSubscribe };
}
