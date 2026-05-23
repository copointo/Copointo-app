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
