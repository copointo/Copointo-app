import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import { useGiftFeed, type GiftFeedEvent } from "@/hooks/useGiftFeed";
import { getGift, type GiftDef } from "@/data/gifts";
import GiftAnimation from "./GiftAnimation";

interface Pending {
  id: string;
  gift: GiftDef;
  fromName: string;
  toName: string;
  count: number;
}

const LAST_SEEN_KEY = "copointo_gift_feed_last_seen_v1";

/**
 * Levels-page gift overlay. Shows a falling-rain animation for every gift
 * sent on the platform — including ones that arrived while the user was
 * offline / on another tab. The last-seen createdAt timestamp is persisted
 * to AsyncStorage so the user only sees gifts NEWER than the last time
 * they opened the Levels page.
 *
 * Includes the user's own sends (so the sender's "preview" is delivered
 * the next time they open the Levels page, not in-place after tapping
 * Send in the picker).
 */
export default function GiftFeedRain() {
  const events = useGiftFeed();
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const playedIdsRef = useRef<Set<string>>(new Set());
  const [queue, setQueue] = useState<Pending[]>([]);
  const [active, setActive] = useState<Pending | null>(null);

  // Hydrate the last-seen cursor from disk on mount.
  useEffect(() => {
    AsyncStorage.getItem(LAST_SEEN_KEY)
      .then(raw => { if (raw) setLastSeenAt(raw); })
      .finally(() => { hydratedRef.current = true; });
  }, []);

  // Pump the queue: whenever there's no active animation but the queue
  // has items, pop the head and show it.
  useEffect(() => {
    if (active || queue.length === 0) return;
    const [head, ...rest] = queue;
    setQueue(rest);
    setActive(head);
  }, [active, queue]);

  // Watch the feed for events newer than our cursor.
  useEffect(() => {
    if (!hydratedRef.current || !Array.isArray(events) || events.length === 0) return;

    const fresh: GiftFeedEvent[] = [];
    for (const e of events) {
      if (lastSeenAt && e.createdAt <= lastSeenAt) continue;
      if (playedIdsRef.current.has(e.id)) continue;
      fresh.push(e);
    }
    if (fresh.length === 0) return;
    fresh.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const additions: Pending[] = [];
    for (const e of fresh) {
      playedIdsRef.current.add(e.id);
      const gd = getGift(e.giftId);
      if (!gd) continue;
      additions.push({
        id:       e.id,
        gift:     gd,
        fromName: e.senderName || "مستخدم",
        toName:   e.recipientName || "مستخدم",
        count:    Math.max(1, e.giftQty ?? 1),
      });
    }
    if (additions.length > 0) {
      setQueue(prev => [...prev, ...additions]);
      // Advance the persisted cursor to the newest event we've now queued.
      const newest = fresh[fresh.length - 1].createdAt;
      setLastSeenAt(newest);
      AsyncStorage.setItem(LAST_SEEN_KEY, newest).catch(() => {});
    }
  }, [events, lastSeenAt]);

  if (!active) return null;

  return (
    <GiftAnimation
      gift={active.gift}
      fromName={active.fromName}
      toName={active.toName}
      count={active.count}
      visible
      onDone={() => setActive(null)}
    />
  );
}
