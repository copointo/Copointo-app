import { Platform } from "react-native";

// On web the shared proxy routes /api → API server (same origin, relative URL works).
// On native we need the full domain, set via EXPO_PUBLIC_API_URL env var.
export const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : (process.env.EXPO_PUBLIC_API_URL ?? "") + "/api";

// Hard request timeout (ms). The chat UI used to "freeze" on slow networks
// because a pending fetch would never resolve and the `submitting` flag
// would stay true forever, disabling the input. AbortController + timeout
// guarantees every request settles in bounded time.
const REQUEST_TIMEOUT_MS = 12_000;
// OMPay's hosted-checkout create + status-check calls are noticeably slower than
// our own endpoints (UAT has been seen at ~30-40s), so the default 12s timeout
// would abort them prematurely. Payment calls pass this longer budget instead.
const PAYMENT_TIMEOUT_MS = 60_000;

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("انتهت مهلة الاتصال — تحقق من الإنترنت وحاول مرة أخرى");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Online payments (OMPay hosted checkout) ────────────────────────────
export type PaymentPurpose = "order" | "booking" | "coins";
export type PaymentStatus = "pending" | "paid" | "failed" | "canceled";

export interface PaymentView {
  id: string;
  reference: string;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  amount: number;
  currency: string;
  checkoutUrl: string | null;
  resultOrderId: string | null;
  resultBookingId: string | null;
  coinsCredited: number | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export interface CreatePaymentInput {
  purpose: PaymentPurpose;
  amount: number; // major OMR units, ≤3 decimals
  description?: string;
  userId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  cafeId?: string | null;
  metadata?: Record<string, unknown>;
  returnUrl?: string; // optional; server defaults to its hosted return page
}

/** Create a hosted-checkout session. Returns the payment (with checkoutUrl) and
 *  a one-time capability `token` used to poll status. Throws on 503/4xx/5xx. */
export async function createPaymentSession(
  input: CreatePaymentInput,
): Promise<{ payment: PaymentView; token: string }> {
  const res = await fetchWithTimeout(
    `${API_BASE}/payments/session`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    PAYMENT_TIMEOUT_MS,
  );
  if (!res.ok) {
    let msg = `payment error ${res.status}`;
    try {
      const j = await res.json();
      if (res.status === 503) msg = j?.message ?? "بوابة الدفع غير مفعّلة بعد";
      else if (j?.error) msg = j.message ?? j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<{ payment: PaymentView; token: string }>;
}

/** Poll the authoritative status of a payment (server re-confirms with OMPay). */
export async function getPaymentStatus(
  id: string,
  token: string,
): Promise<PaymentView> {
  const res = await fetchWithTimeout(
    `${API_BASE}/payments/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
    undefined,
    PAYMENT_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`payment status error ${res.status}`);
  const data = (await res.json()) as { payment: PaymentView };
  return data.payment;
}

/** The server-hosted page the hosted checkout redirects back to. The in-app
 *  browser/WebView detects this URL to know the shopper finished. */
export const PAYMENT_RETURN_URL = `${API_BASE}/payments/return`;

/** Resolve a chat-media reference to a fetchable URL.
 *  - `gcs:chat-media/<uuid>.<ext>` → `${API_BASE}/chat-media/<encoded>/stream`
 *  - anything else (http, data, file) is returned as-is.
 */
export function resolveChatMediaUrl(ref: string | undefined | null): string {
  if (!ref) return "";
  if (ref.startsWith("gcs:")) {
    return `${API_BASE}/chat-media/${encodeURIComponent(ref.slice(4))}/stream`;
  }
  return ref;
}

/** Upload a chat media attachment (image, video, voice note) to the server.
 *  `localUri` is an Expo file URI (e.g. from ImagePicker or audio recorder).
 *  Returns the server reference (`gcs:<key>`) to store on the ChatMessage. */
export async function uploadChatMedia(
  localUri: string,
  contentType: string,
  filename: string,
  kind: "image" | "video" | "audio",
): Promise<string> {
  const fd = new FormData();
  // React Native's FormData accepts {uri, name, type}; on web we need a real Blob.
  if (typeof window !== "undefined" && localUri.startsWith("data:")) {
    const resp = await fetch(localUri);
    const blob = await resp.blob();
    fd.append("file", blob, filename);
  } else if (typeof window !== "undefined" && /^https?:|^blob:/.test(localUri)) {
    const resp = await fetch(localUri);
    const blob = await resp.blob();
    fd.append("file", blob, filename);
  } else {
    fd.append("file", { uri: localUri, name: filename, type: contentType } as any);
  }
  // Server validates `kind` against a MIME allowlist and per-kind size cap.
  fd.append("kind", kind);
  const res = await fetch(`${API_BASE}/chat-media`, { method: "POST", body: fd as any });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`upload failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as { url: string };
  return data.url;
}
