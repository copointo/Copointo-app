import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useGiftFeed } from "./useGiftFeed";

const STORAGE_KEY = "copointo_sent_gifts_last_seen_v1";

let _lastSeen = 0;
let _hydrated = false;
const _listeners = new Set<(t: number) => void>();

async function hydrate() {
  if (_hydrated) return;
  _hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : 0;
    if (Number.isFinite(n) && n > 0) {
      _lastSeen = n;
      _listeners.forEach(l => l(_lastSeen));
    }
  } catch {}
}

/**
 * Mark the Sent Gifts section as seen right now. Persists the timestamp so
 * the badge stays cleared across reloads — until a new gift event arrives.
 */
export async function markSentGiftsSeen() {
  const now = Date.now();
  _lastSeen = now;
  try { await AsyncStorage.setItem(STORAGE_KEY, String(now)); } catch {}
  _listeners.forEach(l => l(_lastSeen));
}

/**
 * Returns the number of gift-feed events newer than the last time the user
 * opened the Sent Gifts screen. Capped at 99 for display.
 */
export function useUnseenSentGifts(): number {
  const events = useGiftFeed();
  const [lastSeen, setLastSeen] = useState(_lastSeen);

  useEffect(() => {
    hydrate();
    const l = (t: number) => setLastSeen(t);
    _listeners.add(l);
    return () => { _listeners.delete(l); };
  }, []);

  let count = 0;
  for (const e of events) {
    const t = new Date(e.createdAt).getTime();
    if (Number.isFinite(t) && t > lastSeen) count++;
  }
  return Math.min(count, 99);
}
