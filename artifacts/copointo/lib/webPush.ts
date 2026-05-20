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
 * Result of attempting to enable web push. Carries a human-readable
 * `reason` so the UI can tell the user EXACTLY what failed instead of
 * just showing a generic "error" toast (which was happening before —
 * silent returns of `false` made the Switch look broken).
 */
export type EnableWebPushResult =
  | { ok: true }
  | { ok: false; reason:
      | "unsupported"
      | "no-user"
      | "permission-denied"
      | "permission-dismissed"
      | "sw-register-failed"
      | "vapid-fetch-failed"
      | "subscribe-failed"
      | "subscription-invalid"
      | "server-rejected"; detail?: string };

export async function enableWebPush(userId: string): Promise<EnableWebPushResult> {
  if (!isWebPushSupported()) return { ok: false, reason: "unsupported" };
  if (!userId) return { ok: false, reason: "no-user" };

  // Request permission first — must be triggered by a user gesture on
  // most browsers, so call sites should invoke this from an onPress.
  let perm = Notification.permission;
  if (perm === "default") {
    try { perm = await Notification.requestPermission(); }
    catch (e) { return { ok: false, reason: "permission-dismissed", detail: String(e) }; }
  }
  if (perm === "denied") return { ok: false, reason: "permission-denied" };
  if (perm !== "granted") return { ok: false, reason: "permission-dismissed" };

  const reg = await getRegistration();
  if (!reg) return { ok: false, reason: "sw-register-failed" };

  // Wait for the SW to actually be ready before subscribing — otherwise
  // pushManager.subscribe can throw "no active service worker".
  try { await navigator.serviceWorker.ready; } catch { /* fall through */ }

  const vapidKey = await fetchVapidPublicKey();
  if (!vapidKey) return { ok: false, reason: "vapid-fetch-failed" };

  let sub: PushSubscription | null = null;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }
  } catch (e) {
    return { ok: false, reason: "subscribe-failed", detail: String(e) };
  }

  // Ship the subscription to the backend.
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) {
    return { ok: false, reason: "subscription-invalid" };
  }
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
    if (!res.ok) return { ok: false, reason: "server-rejected", detail: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "server-rejected", detail: String(e) };
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
