import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { getRank } from "@/data/mockData";

const BG     = "#000000";
const ACCENT = "#E8B86D";

// Local-only state for showing the green/red confirmation chip after the user
// taps accept/decline (so the row doesn't just vanish without feedback).
type Decision = "accepted" | "rejected";

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    incomingRequests, registeredUsers,
    acceptFriendRequest, declineFriendRequest, refreshFriendData,
  } = useApp();

  // Track recent decisions so the row stays visible briefly with status
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  // Whenever this screen comes into focus, re-pull friend/request data from
  // storage in case another logged-in user on the same device sent something.
  useFocusEffect(
    useCallback(() => {
      refreshFriendData();
    }, [refreshFriendData])
  );

  // Build display rows from the incoming-request IDs, hydrated from
  // registeredUsers. If a sender id no longer matches a known user (e.g. they
  // were removed) we just skip it.
  const rows = useMemo(() => {
    return incomingRequests
      .map(senderId => {
        const u = registeredUsers.find(r => r.id === senderId);
        if (!u) return null;
        return {
          id: senderId,
          name: u.name,
          username: u.gameUsername,
          level: u.level,
        };
      })
      .filter((r): r is { id: string; name: string; username: string; level: number } => r !== null);
  }, [incomingRequests, registeredUsers]);

  const handleAccept = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDecisions(prev => ({ ...prev, [id]: "accepted" }));
    await acceptFriendRequest(id);
  };

  const handleDecline = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDecisions(prev => ({ ...prev, [id]: "rejected" }));
    await declineFriendRequest(id);
  };

  // Recently-decided rows we want to keep showing for a short moment after
  // they're removed from incomingRequests by the context.
  const recentlyDecided = Object.entries(decisions).filter(
    ([id]) => !incomingRequests.includes(id)
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإشعارات</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {rows.length === 0 && recentlyDecided.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
            <Text style={styles.emptySub}>
              عندما يرسل لك أحد طلب صداقة سيظهر هنا
            </Text>
          </View>
        )}

        {/* Pending friend requests */}
        {rows.map((r) => {
          const rankInfo = getRank(r.level);
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={{ fontSize: 22 }}>👤</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{r.name}</Text>
                  <Text style={styles.cardSub}>
                    @{r.username} · مستوى {r.level} · {rankInfo.icon}
                  </Text>
                  <Text style={styles.cardHint}>أرسل لك طلب صداقة</Text>
                </View>
              </View>

              <View style={styles.friendActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAccept(r.id)}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={15} color="#000" />
                  <Text style={styles.acceptBtnText}>قبول</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleDecline(r.id)}
                  activeOpacity={0.85}
                >
                  <Feather name="x" size={15} color="#E55353" />
                  <Text style={styles.rejectBtnText}>رفض</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Recently decided — stay visible briefly with status chip */}
        {recentlyDecided.map(([id, decision]) => {
          const u = registeredUsers.find(r => r.id === id);
          if (!u) return null;
          return (
            <View key={`done-${id}`} style={[styles.card, { opacity: 0.7 }]}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={{ fontSize: 22 }}>👤</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{u.name}</Text>
                  <Text style={styles.cardSub}>@{u.gameUsername}</Text>
                </View>
              </View>
              <View style={[
                styles.statusTag,
                { backgroundColor: decision === "accepted" ? "rgba(125,216,125,0.18)" : "rgba(229,83,83,0.18)" },
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: decision === "accepted" ? "#7DD87D" : "#E55353" },
                ]}>
                  {decision === "accepted" ? "✓ أصبحتما صديقَين" : "✕ تم رفض الطلب"}
                </Text>
              </View>
            </View>
          );
        })}

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "#0A0606",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF",
  },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  card: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.25)",
    gap: 14,
  },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(232,184,109,0.12)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF",
  },
  cardSub: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
  },
  cardHint: {
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: ACCENT, marginTop: 4,
  },
  friendActions: { flexDirection: "row", gap: 10 },
  acceptBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    backgroundColor: ACCENT,
    paddingVertical: 11, borderRadius: 12,
  },
  acceptBtnText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#000",
  },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    backgroundColor: "rgba(229,83,83,0.10)",
    borderWidth: 1, borderColor: "rgba(229,83,83,0.50)",
    paddingVertical: 11, borderRadius: 12,
  },
  rejectBtnText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#E55353",
  },
  statusTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 13, fontFamily: "Inter_600SemiBold",
  },
  emptyWrap: { alignItems: "center", paddingTop: 100, gap: 10 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.50)",
    textAlign: "center", paddingHorizontal: 32,
  },
});
