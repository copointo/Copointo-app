/**
 * Expo Push notifications helper.
 *
 * Sends notifications to one or many users by looking up their registered
 * Expo push tokens in the in-memory `pushTokens` store. Calls the public
 * Expo Push API (https://exp.host/--/api/v2/push/send) which does not
 * require any API key for standard usage.
 *
 * Failures are logged but never thrown — push notifications are a
 * best-effort side-effect that must not block the primary request
 * handler (e.g. a chat message must still be persisted even if Expo is
 * down). Invalid tokens reported by Expo are pruned automatically so a
 * stale token doesn't keep getting retried.
 */
import { pushTokens, persistStore } from "../store";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  /** Notification title (shown bold at top of the system notification). */
  title: string;
  /** Notification body (the main message text). */
  body: string;
  /**
   * Optional structured data delivered to the app. The mobile app can
   * read this in the tap-handler to deep-link to the right screen
   * (e.g. { type: "chat", conversationId: "..." }).
   */
  data?: Record<string, unknown>;
  /**
   * Optional channel id (Android). Defaults to "default". We define a
   * single rich "default" channel in the mobile app with the Copointo
   * brand colour and the logo as the small icon.
   */
  channelId?: string;
  /** iOS-only badge count. */
  badge?: number;
}

function isExpoToken(t: unknown): boolean {
  return typeof t === "string"
    && (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));
}

function buildMessages(tokens: string[], payload: PushPayload) {
  return tokens.map(to => ({
    to,
    title: payload.title,
    body: payload.body,
    sound: "default",
    priority: "high",
    channelId: payload.channelId ?? "default",
    ...(payload.badge != null ? { badge: payload.badge } : {}),
    ...(payload.data ? { data: payload.data } : {}),
  }));
}

/**
 * Remove tokens that Expo flagged as DeviceNotRegistered (i.e. the user
 * uninstalled the app or revoked the permission). Keeps the store tidy
 * and prevents wasted push attempts.
 */
function pruneInvalidTokens(invalidTokens: Set<string>) {
  if (invalidTokens.size === 0) return;
  let removed = 0;
  for (let i = pushTokens.length - 1; i >= 0; i--) {
    if (invalidTokens.has(pushTokens[i]!.token)) {
      pushTokens.splice(i, 1);
      removed++;
    }
  }
  if (removed > 0) {
    persistStore();
    logger.info({ removed }, "pruned invalid Expo push tokens");
  }
}

/**
 * Send a push notification to every token registered for `userId`. A
 * user may have multiple devices — all of them receive the same payload.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!userId) return;
  const tokens = pushTokens
    .filter(p => p.userId === userId && isExpoToken(p.token))
    .map(p => p.token);
  if (tokens.length === 0) return;
  await sendToTokens(tokens, payload);
}

/** Fan-out helper: send the same payload to every token of every user id. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!userIds || userIds.length === 0) return;
  const set = new Set(userIds);
  const tokens = pushTokens
    .filter(p => set.has(p.userId) && isExpoToken(p.token))
    .map(p => p.token);
  if (tokens.length === 0) return;
  await sendToTokens(tokens, payload);
}

/** Send to every registered token (super-admin broadcast). */
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  const tokens = pushTokens.filter(p => isExpoToken(p.token)).map(p => p.token);
  if (tokens.length === 0) return;
  await sendToTokens(tokens, payload);
}

async function sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
  // Expo accepts up to 100 messages per request.
  const CHUNK = 100;
  const invalid = new Set<string>();
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    const messages = buildMessages(chunk, payload);
    try {
      const r = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });
      if (!r.ok) {
        logger.warn({ status: r.status }, "Expo push API non-ok");
        continue;
      }
      const json: any = await r.json().catch(() => null);
      const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
      tickets.forEach((ticket, idx) => {
        if (ticket?.status === "error") {
          const errType = ticket?.details?.error;
          if (errType === "DeviceNotRegistered") {
            const tok = chunk[idx];
            if (tok) invalid.add(tok);
          } else {
            logger.warn({ ticket }, "Expo push ticket error");
          }
        }
      });
    } catch (err) {
      logger.warn({ err }, "Expo push request failed");
    }
  }
  pruneInvalidTokens(invalid);
}
