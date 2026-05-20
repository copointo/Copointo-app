/* Copointo Web Push service worker.
 *
 * Receives push events from the browser's push service even when the
 * site is closed and shows a system notification. Clicking the
 * notification focuses an existing Copointo tab if one is open, or
 * opens a new one at the URL embedded in the push payload.
 *
 * The sound is provided by the OS — system notifications on Android
 * Chrome play the user's default notification sound, and on Windows /
 * macOS Chrome they play the system notification chime. We additionally
 * set `silent: false` and a `vibrate` pattern to maximize the chance
 * of audible/tactile feedback on supported platforms.
 */

self.addEventListener("install", (event) => {
  // Activate immediately on first install so the very next push is
  // received without requiring the user to close & re-open the tab.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Copointo", body: "", icon: "/copointo-logo.png", url: "/", data: {} };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    try {
      const text = event.data?.text() ?? "";
      if (text) payload.body = text;
    } catch { /* fall through with defaults */ }
  }

  const options = {
    body: payload.body || "",
    icon: payload.icon || "/copointo-logo.png",
    badge: "/copointo-logo.png",
    silent: false,
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || undefined,
    renotify: true,
    data: { url: payload.url || "/", ...(payload.data || {}) },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Copointo", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Try to focus an existing tab on the same origin.
    for (const client of all) {
      try {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(targetUrl); } catch { /* cross-origin guard */ }
          }
          return;
        }
      } catch { /* ignore malformed urls */ }
    }
    // Otherwise open a fresh tab.
    await self.clients.openWindow(targetUrl);
  })());
});
