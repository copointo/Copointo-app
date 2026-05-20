/**
 * Web Push (browser) notifications helper.
 *
 * Companion to `push.ts` (which handles Expo native push tokens). This
 * module handles the W3C Push API used by browsers — including Chrome /
 * Safari / Firefox on phones and laptops — so a user who opened
 * copointo.com on their phone browser can receive push notifications
 * with sound even when the site is closed.
 *
 * VAPID keys are auto-generated on first boot and persisted to
 * `uploads/vapid.json`. The public key is exposed to clients via a
 * dedicated GET endpoint so they don't need any build-time env config.
 *
 * Failures are logged but never thrown — push delivery must never
 * block the primary request handler.
 */
import webpush from "web-push";
import fs from "node:fs";
import path from "node:path";
import { webPushSubscriptions, persistStore, type WebPushSubscription } from "../store";
import { logger } from "./logger";

const VAPID_FILE = path.join(process.cwd(), "uploads", "vapid.json");
const CONTACT = process.env.VAPID_CONTACT || "mailto:admin@copointo.com";

interface VapidKeys { publicKey: string; privateKey: string }
let cachedKeys: VapidKeys | null = null;

function loadOrGenerateVapidKeys(): VapidKeys {
  if (cachedKeys) return cachedKeys;
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const raw = fs.readFileSync(VAPID_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed?.publicKey && parsed?.privateKey) {
        cachedKeys = parsed;
        webpush.setVapidDetails(CONTACT, parsed.publicKey, parsed.privateKey);
        return parsed;
      }
    }
  } catch (err) {
    logger.warn({ err }, "failed to read vapid.json — regenerating");
  }
  // First boot — generate and persist.
  const keys = webpush.generateVAPIDKeys();
  try {
    fs.mkdirSync(path.dirname(VAPID_FILE), { recursive: true });
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), "utf8");
    logger.info("generated new VAPID keys for web push");
  } catch (err) {
    logger.warn({ err }, "failed to persist vapid.json — keys are in-memory only");
  }
  cachedKeys = keys;
  webpush.setVapidDetails(CONTACT, keys.publicKey, keys.privateKey);
  return keys;
}

/** Public VAPID key — safe to expose to clients via API. */
export function getVapidPublicKey(): string {
  return loadOrGenerateVapidKeys().publicKey;
}

/** Force initialization at boot so `web-push` library is configured. */
export function initWebPush(): void {
  loadOrGenerateVapidKeys();
}

export interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Optional icon URL shown in the notification. */
  icon?: string;
  /** Optional URL to open when notification is clicked. */
  url?: string;
}

/**
 * Send a web-push notification to every browser subscription registered
 * for `userId`. Invalid (410/404) subscriptions are pruned automatically.
 */
export async function sendWebPushToUser(userId: string, payload: WebPushPayload): Promise<void> {
  if (!userId) return;
  const subs = webPushSubscriptions.filter(s => s.userId === userId);
  if (subs.length === 0) return;
  await sendToSubscriptions(subs, payload);
}

export async function sendWebPushToUsers(userIds: string[], payload: WebPushPayload): Promise<void> {
  if (!userIds || userIds.length === 0) return;
  const set = new Set(userIds);
  const subs = webPushSubscriptions.filter(s => set.has(s.userId));
  if (subs.length === 0) return;
  await sendToSubscriptions(subs, payload);
}

export async function sendWebPushToAll(payload: WebPushPayload): Promise<void> {
  if (webPushSubscriptions.length === 0) return;
  await sendToSubscriptions(webPushSubscriptions.slice(), payload);
}

async function sendToSubscriptions(subs: WebPushSubscription[], payload: WebPushPayload): Promise<void> {
  loadOrGenerateVapidKeys();
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? "/copointo-logo.png",
    url: payload.url ?? "/",
    data: payload.data ?? {},
  });
  const dead: string[] = [];
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        body,
        { TTL: 60 * 60 * 24 },
      );
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // Subscription expired or was unsubscribed by the user.
        dead.push(s.endpoint);
      } else {
        logger.warn({ err: err?.message ?? err, status }, "web-push send failed");
      }
    }
  }));
  if (dead.length > 0) pruneSubscriptions(dead);
}

function pruneSubscriptions(deadEndpoints: string[]): void {
  const set = new Set(deadEndpoints);
  let removed = 0;
  for (let i = webPushSubscriptions.length - 1; i >= 0; i--) {
    if (set.has(webPushSubscriptions[i]!.endpoint)) {
      webPushSubscriptions.splice(i, 1);
      removed++;
    }
  }
  if (removed > 0) {
    persistStore();
    logger.info({ removed }, "pruned dead web-push subscriptions");
  }
}
