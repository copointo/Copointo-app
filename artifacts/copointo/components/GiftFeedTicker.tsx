import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useGiftFeed, type GiftFeedEvent } from "@/hooks/useGiftFeed";
import { getGift } from "@/data/gifts";

interface AggregatedEvent {
  key: string;
  senderName: string;
  recipientName: string;
  giftId: string;
  count: number;
  latestAt: string;
}

/**
 * Aggregate consecutive events with the same (sender, recipient, giftId)
 * triple within a short window into a single "×N" entry, then return them
 * in newest-first order.
 */
function aggregate(events: GiftFeedEvent[]): AggregatedEvent[] {
  const buckets = new Map<string, AggregatedEvent>();
  for (const e of events) {
    const k = `${e.senderId}|${e.recipientId}|${e.giftId}`;
    const qty = Math.max(1, e.giftQty ?? 1);
    const cur = buckets.get(k);
    if (cur) {
      cur.count += qty;
      if (e.createdAt > cur.latestAt) cur.latestAt = e.createdAt;
    } else {
      buckets.set(k, {
        key: k,
        senderName: e.senderName,
        recipientName: e.recipientName,
        giftId: e.giftId,
        count: qty,
        latestAt: e.createdAt,
      });
    }
  }
  return Array.from(buckets.values()).sort((a, b) =>
    b.latestAt.localeCompare(a.latestAt),
  );
}

export default function GiftFeedTicker() {
  const events = useGiftFeed();
  const aggregated = useMemo(() => aggregate(events), [events]);

  // ── Marquee animation (loops a horizontal scroll of the line) ──
  const tx = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  useEffect(() => {
    if (aggregated.length === 0) return;
    const loop = () => {
      tx.setValue(0);
      Animated.timing(tx, {
        toValue: -widthRef.current,
        duration: Math.max(8000, aggregated.length * 3500),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished) loop(); });
    };
    const t = setTimeout(loop, 250);
    return () => clearTimeout(t);
  }, [aggregated.length]);

  if (aggregated.length === 0) return null;

  const renderItems = (keyPrefix: string) => aggregated.map(ev => {
    const gd = getGift(ev.giftId);
    const color = gd?.color ?? "#E8B86D";
    return (
      <View key={`${keyPrefix}_${ev.key}`} style={styles.item}>
        <Text style={styles.gift}>{gd?.emoji ?? "🎁"}</Text>
        <Text style={styles.text} numberOfLines={1}>
          <Text style={styles.bold}>{ev.senderName}</Text>
          <Text> أهدى </Text>
          <Text style={styles.bold}>{ev.recipientName}</Text>
          <Text> {gd?.name ?? "هدية"}</Text>
        </Text>
        {ev.count > 1 && (
          <View style={[styles.countPill, { backgroundColor: color + "22", borderColor: color + "66" }]}>
            <Text style={[styles.countText, { color }]}>×{ev.count}</Text>
          </View>
        )}
        <Text style={styles.dot}>•</Text>
      </View>
    );
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.viewport}>
        <Animated.View
          style={[styles.row, { transform: [{ translateX: tx }] }]}
          onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width / 2; }}
        >
          {/* Render twice so the marquee can seamlessly loop */}
          {renderItems("a")}
          {renderItems("b")}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "rgba(232,184,109,0.08)",
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: "rgba(232,184,109,0.30)",
    paddingVertical: 6,
  },
  viewport: { overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center" },
  item: { flexDirection: "row", alignItems: "center", marginHorizontal: 6 },
  gift: { fontSize: 16, marginHorizontal: 4 },
  text: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.92)",
  },
  bold: { fontFamily: "Inter_700Bold", color: "#E8B86D" },
  countPill: {
    marginHorizontal: 6,
    paddingHorizontal: 7, paddingVertical: 1,
    borderRadius: 8, borderWidth: 1,
  },
  countText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  dot: { color: "rgba(232,184,109,0.45)", marginHorizontal: 8, fontSize: 12 },
});
