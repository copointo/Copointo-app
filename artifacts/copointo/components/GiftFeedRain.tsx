import React, { useEffect, useRef, useState } from "react";
import { useGiftFeed, type GiftFeedEvent } from "@/hooks/useGiftFeed";
import { useApp } from "@/context/AppContext";
import { getGift, type GiftDef } from "@/data/gifts";
import GiftAnimation from "./GiftAnimation";

interface Pending {
  gift: GiftDef;
  fromName: string;
  toName: string;
  count: number;
}

/**
 * Global gift-feed overlay. Listens to the public gift feed and plays the
 * falling-rain animation on EVERY screen whenever a new gift is sent
 * anywhere on the platform — captioned with the sender + recipient
 * usernames. Replaces the old top-of-screen marquee ticker.
 *
 * Behaviour:
 *  - On first mount, snapshots the current feed ids so we don't replay
 *    the entire history.
 *  - Skips events the local user sent themselves (their own send screen
 *    already plays the animation).
 *  - Queues new events and plays them one at a time so multiple gifts
 *    that arrive in the same poll cycle don't overlap.
 */
export default function GiftFeedRain() {
  const events = useGiftFeed();
  const { user } = useApp();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [active, setActive] = useState<Pending | null>(null);

  // Pump the queue: whenever there's no active animation but the queue has
  // items, pop the head and show it.
  useEffect(() => {
    if (active || queue.length === 0) return;
    setActive(queue[0]);
    setQueue(prev => prev.slice(1));
  }, [active, queue]);

  // Watch the feed for new events.
  useEffect(() => {
    if (!Array.isArray(events)) return;

    // First time we see ANY events, treat them all as "already seen" so
    // we don't replay the historical backlog when a user opens the app.
    if (!initializedRef.current) {
      events.forEach(e => seenIdsRef.current.add(e.id));
      initializedRef.current = true;
      return;
    }

    // Find new events (oldest first so the queue plays in order).
    const fresh: GiftFeedEvent[] = [];
    for (const e of events) {
      if (!seenIdsRef.current.has(e.id)) {
        seenIdsRef.current.add(e.id);
        fresh.push(e);
      }
    }
    if (fresh.length === 0) return;
    fresh.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const myId = user?.id;
    const additions: Pending[] = [];
    for (const e of fresh) {
      if (myId && e.senderId === myId) continue; // skip self-sent
      const gd = getGift(e.giftId);
      if (!gd) continue;
      additions.push({
        gift: gd,
        fromName: e.senderName || "مستخدم",
        toName:   e.recipientName || "مستخدم",
        count:    Math.max(1, e.giftQty ?? 1),
      });
    }
    if (additions.length > 0) {
      setQueue(prev => [...prev, ...additions]);
    }
  }, [events, user?.id]);

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
