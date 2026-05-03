import { Platform } from "react-native";

// On web the shared proxy routes /api → API server (same origin, relative URL works).
// On native we need the full domain, set via EXPO_PUBLIC_API_URL env var.
export const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : (process.env.EXPO_PUBLIC_API_URL ?? "") + "/api";

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}
