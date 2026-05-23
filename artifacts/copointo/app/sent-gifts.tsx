import { Feather } from "@expo/vector-icons";
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

const PRIMARY = "#E8B86D";
const GIFT_BY_ID = new Map<string, GiftDef>(GIFTS.map(g => [g.id, g]));

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
      const res = await fetch(`${API_BASE}/gift-feed?limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.events)) setEvents(data.events as GiftEvent[]);
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (mounted) setLoading(false);
    })();
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
    const color = gift?.color ?? PRIMARY;
    return (
      <View style={styles.card}>
        <View style={[styles.giftBubble, { borderColor: color }]}>
          {gift?.image ? (
            <Image source={gift.image} style={styles.giftImg} resizeMode="contain" />
          ) : (
            <Text style={[styles.giftEmoji, { color }]}>{gift?.emoji ?? "🎁"}</Text>
          )}
          {item.giftQty > 1 && (
            <View style={[styles.qtyChip, { borderColor: color }]}>
              <Text style={[styles.qtyText, { color }]}>×{item.giftQty}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.giftName, { color }]} numberOfLines={1}>
            {gift?.name ?? "هدية"}
          </Text>
          <View style={styles.namesRow}>
            <Text style={styles.nameStrong} numberOfLines={1}>
              {item.senderName}
            </Text>
            <Feather name="arrow-left" size={14} color={PRIMARY} style={{ marginHorizontal: 6 }} />
            <Text style={styles.nameStrong} numberOfLines={1}>
              {item.recipientName}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={11} color="#888" />
            <Text style={styles.metaText}>{when.date}</Text>
            <Feather name="clock" size={11} color="#888" style={{ marginStart: 10 }} />
            <Text style={styles.metaText}>{when.time}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Feather name="arrow-right" size={22} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.title}>الهدايا المرسلة</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎁</Text>
          <Text style={styles.emptyText}>لا توجد هدايا مرسلة بعد</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={e => e.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 12,
            paddingBottom: insets.bottom + 24,
            gap: 10,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
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
  title: {
    fontSize: 18,
    fontFamily: Platform.select({ ios: "Inter_700Bold", default: "Inter_700Bold" }),
    color: PRIMARY,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: "#888", fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0c0c0c",
    borderWidth: 1,
    borderColor: "#1f1f1f",
    borderRadius: 14,
    padding: 12,
  },
  giftBubble: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: "#0a0a0a",
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  giftImg: { width: 50, height: 50 },
  giftEmoji: { fontSize: 32, lineHeight: 36 },
  qtyChip: {
    position: "absolute",
    bottom: -6, right: -6,
    backgroundColor: "#000",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  qtyText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  cardBody: { flex: 1, gap: 4 },
  giftName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  namesRow: { flexDirection: "row", alignItems: "center" },
  nameStrong: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 110,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { color: "#888", fontSize: 11 },
});
