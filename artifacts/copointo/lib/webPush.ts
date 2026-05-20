/**
 * Web Push (browser) helpers for the Copointo Expo web build.
 *
 * Native (iOS/Android app) uses `expo-notifications` directly in
 * profile.tsx. This module is the WEB equivalent — it registers a
 * service worker, requests browser notification permission, subscribes
 * to the W3C Push API using the server's VAPID public key, and POSTs
 * the resulting subscription to the backend so the server can send
 * push notifications to the user even when the site is closed.
 *
 * All functions return `false`/`null` rather than throwing on
 * unsupported environments (Platform.OS !== "web", missing
 * `navigator.serviceWorker`, denied permission, etc.) so call sites
 * stay simple.
 */
import { Platform } from "react-native";
import { API_BASE } from "@/constants/api";

const SW_URL = "/sw.js";
const SW_SCOPE = "/";

export function isWebPushSupported(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;
  return true;
}

/** Current OS permission. "default" means not yet asked. */
export function getWebPushPermission(): "granted" | "denied" | "default" | "unsupported" {
  if (!isWebPushSupported()) return "unsupported";
  return Notification.permission;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/push/web/vapid-public-key`);
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.publicKey === "string" ? json.publicKey : null;
  } catch {
    return null;
  }
}

/** Returns the existing subscription, if any. */
export async function getExistingWebPushSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Enable web push for the user:
 *  1. Request browser permission (browser will show its prompt)
 *  2. Subscribe to the push service using the server's VAPID key
 *  3. POST the subscription to the backend so the server can send to it
 *
 * Returns true on success.
 */
export async function enableWebPush(userId: string): Promise<boolean> {
  if (!isWebPushSupported() || !userId) return false;

  // Request permission first — must be triggered by a user gesture on
  // most browsers, so call sites should invoke this from an onPress.
  let perm = Notification.permission;
  if (perm === "default") {
    try { perm = await Notification.requestPermission(); } catch { return false; }
  }
  if (perm !== "granted") return false;

  const reg = await getRegistration();
  if (!reg) return false;

  const vapidKey = await fetchVapidPublicKey();
  if (!vapidKey) return false;

  let sub: PushSubscription | null = null;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }
  } catch {
    return false;
  }

  // Ship the subscription to the backend.
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) return false;
  try {
    const res = await fetch(`${API_BASE}/push/web/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        subscription: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        },
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Disable web push for the user: unsubscribe locally AND tell the
 * server to forget this endpoint so it stops sending pushes to it.
 */
export async function disableWebPush(userId: string): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  const sub = await getExistingWebPushSubscription();
  const endpoint = sub?.endpoint;
  try { await sub?.unsubscribe(); } catch { /* best-effort */ }
  if (!endpoint) return true;
  try {
    await fetch(`${API_BASE}/push/web/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, endpoint }),
    });
  } catch { /* best-effort */ }
  return true;
}

/** True when the user has an active subscription AND granted permission. */
export async function isWebPushEnabled(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const sub = await getExistingWebPushSubscription();
  return !!sub;
}
