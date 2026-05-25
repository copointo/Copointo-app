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

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
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
