/* eslint-disable no-undef */
/* Service worker — handles web push notifications */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Predict Market", body: event.data.text() };
  }

  const options = {
    body: payload.body ?? "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.data?.marketId ?? "predict-market",
    renotify: true,
    data: payload.data ?? {},
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Predict Market", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/portfolio";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow(url);
      })
  );
});
