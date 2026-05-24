import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE } from "@/constants/api";
import { GIFTS, type GiftDef } from "@/data/gifts";
import { markSentGiftsSeen } from "@/hooks/useUnseenSentGifts";

interface GiftEvent {
  id: string;
  giftId: string;
  giftQty: number;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  createdAt: string;
}

const ACCENT = "#E8484C";
const GIFT_BY_ID = new Map<string, GiftDef>(GIFTS.map(g => [g.id, g]));

/** Convert "#RRGGBB" → "rgba(r,g,b,a)" for soft tinted backgrounds. */
function tint(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(232,72,76,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function formatWhen(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const time = d.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { date, time };
  } catch {
    return { date: "", time: "" };
  }
}

export default function SentGiftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<GiftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/gift-feed?limit=200`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.events)) {
        // Only keep gifts sent in the last 7 days. Anything older drops off
        // the list automatically the next time this screen mounts/refreshes.
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = (data.events as GiftEvent[]).filter(e => {
          const t = new Date(e.createdAt).getTime();
          return Number.isFinite(t) && t >= cutoff;
        });
        setEvents(recent);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (mounted) setLoading(false);
    })();
    // Clear the unseen-sent-gifts badge as soon as the user opens this screen.
    markSentGiftsSeen();
    return () => { mounted = false; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = ({ item }: { item: GiftEvent }) => {
    const gift = GIFT_BY_ID.get(item.giftId);
    const when = formatWhen(item.createdAt);
    const color = gift?.color ?? ACCENT;
    return (
      <View
        style={[
          styles.card,
          {
            borderColor: tint(color, 0.55),
            shadowColor: color,
          },
        ]}
      >
        {/* Soft color wash background */}
        <LinearGradient
          colors={[tint(color, 0.18), tint(color, 0.04), "rgba(0,0,0,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Accent stripe on the right edge (RTL "start") */}
        <View style={[styles.accentBar, { backgroundColor: color }]} />

        {/* Gift visual */}
        <View style={[styles.giftBubble, { borderColor: color, backgroundColor: tint(color, 0.12) }]}>
          {gift?.image ? (
            <Image source={gift.image} style={styles.giftImg} resizeMode="contain" />
          ) : (
            <Text style={[styles.giftEmoji, { color }]}>{gift?.emoji ?? "🎁"}</Text>
          )}
          {item.giftQty > 1 && (
            <View style={[styles.qtyChip, { borderColor: color, backgroundColor: "#000" }]}>
              <Text style={[styles.qtyText, { color }]}>×{item.giftQty}</Text>
            </View>
          )}
        </View>

        {/* Text block */}
        <View style={styles.cardBody}>
          <Text style={[styles.giftName, { color }]} numberOfLines={1}>
            {gift?.name ?? "هدية"}
          </Text>

          <View style={styles.namesRow}>
            <View style={[styles.namePill, { borderColor: tint(color, 0.6) }]}>
              <Feather name="user" size={10} color={color} />
              <Text style={styles.nameStrong} numberOfLines={1}>
                {item.senderName}
              </Text>
            </View>
            <Feather name="arrow-left" size={14} color={color} style={{ marginHorizontal: 4 }} />
            <View style={[styles.namePill, { borderColor: tint(color, 0.6) }]}>
              <Feather name="user-check" size={10} color={color} />
              <Text style={styles.nameStrong} numberOfLines={1}>
                {item.recipientName}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Feather name="calendar" size={10} color="#aaa" />
              <Text style={styles.metaText}>{when.date}</Text>
            </View>
            <View style={styles.metaChip}>
              <Feather name="clock" size={10} color="#aaa" />
              <Text style={styles.metaText}>{when.time}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar with back + page title */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Feather name="arrow-right" size={22} color={ACCENT} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>🎁 الهدايا</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Hero header (in-list) */}
      <FlatList
        data={loading || events.length === 0 ? [] : events}
        keyExtractor={e => e.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.hero}>
            <LinearGradient
              colors={[tint(ACCENT, 0.22), tint(ACCENT, 0.05), "rgba(0,0,0,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.heroTitle}>الهدايا المرسلة من المستخدمين</Text>
            <Text style={styles.heroSub}>
              هدايا آخر 7 أيام فقط ({events.length || "—"}) — تتجدد القائمة أسبوعياً
            </Text>
            <View style={[styles.heroBar, { backgroundColor: ACCENT }]} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>🎁</Text>
              <Text style={styles.emptyText}>لا توجد هدايا مرسلة بعد</Text>
            </View>
          )
        }
        contentContainerStyle={{
          padding: 12,
          paddingBottom: insets.bottom + 24,
          gap: 12,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  backBtn: {
    width: 32, height: 32,
    alignItems: "center", justifyContent: "center",
  },
  topTitle: {
    fontSize: 17,
    fontFamily: Platform.select({ ios: "Inter_700Bold", default: "Inter_700Bold" }),
    color: ACCENT,
  },

  hero: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(232,72,76,0.4)",
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 4,
    alignItems: "center",
    position: "relative",
  },
  heroTitle: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    textAlign: "center",
  },
  heroSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#bbb",
    textAlign: "center",
    marginTop: 6,
  },
  heroBar: {
    width: 40, height: 3,
    borderRadius: 2,
    marginTop: 10,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: "#888", fontSize: 14 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0c0c0c",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 4,
  },
  accentBar: {
    position: "absolute",
    right: 0, top: 0, bottom: 0,
    width: 4,
  },
  giftBubble: {
    width: 68, height: 68, borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  giftImg: { width: 54, height: 54 },
  giftEmoji: { fontSize: 34, lineHeight: 38 },
  qtyChip: {
    position: "absolute",
    bottom: -6, right: -6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  qtyText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  cardBody: { flex: 1, gap: 6 },
  giftName: { fontSize: 15, fontFamily: "Inter_700Bold" },

  namesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  namePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  nameStrong: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    maxWidth: 96,
  },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  metaText: { color: "#aaa", fontSize: 10.5, fontFamily: "Inter_500Medium" },
});
