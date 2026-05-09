import { useEffect, useState } from "react";
import { API_BASE } from "@/constants/api";

export interface GiftFeedEvent {
  id: string;
  giftId: string;
  giftQty: number;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  createdAt: string;
}

let _cache: GiftFeedEvent[] = [];
const _listeners = new Set<(e: GiftFeedEvent[]) => void>();
let _polling = false;

function broadcast(e: GiftFeedEvent[]) {
  _cache = e;
  _listeners.forEach(l => l(e));
}

async function pollOnce() {
  try {
    const res = await fetch(`${API_BASE}/gift-feed?limit=30`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data?.events)) broadcast(data.events as GiftFeedEvent[]);
  } catch {}
}

function startPolling() {
  if (_polling) return;
  _polling = true;
  pollOnce();
  setInterval(pollOnce, 8000);
}

export function useGiftFeed() {
  const [events, setEvents] = useState<GiftFeedEvent[]>(_cache);
  useEffect(() => {
    const listener = (e: GiftFeedEvent[]) => setEvents(e);
    _listeners.add(listener);
    startPolling();
    return () => { _listeners.delete(listener); };
  }, []);
  return events;
}
