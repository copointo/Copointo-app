import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { apiFetch } from "@/constants/api";

interface Broadcast { id: string; message: string; createdAt: string; }
interface FreeCoffeeNotif {
  id: string;
  code: string;
  earnedAtLevel: number;
  earnedAt: string;
  earnedAtCafeId?: string | null;
  earnedAtCafeName?: string | null;
  redeemedAt: string | null;
}

const BROADCAST_LAST_SEEN_KEY    = "copointo_broadcast_last_seen_v1";
const FREE_COFFEE_LAST_SEEN_KEY  = "copointo_free_coffee_last_seen_v1";

const fmtRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)   return "الآن";
  if (m < 60)  return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return `قبل ${d} يوم`;
};

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
    user,
    incomingRequests, registeredUsers,
    acceptFriendRequest, declineFriendRequest, refreshFriendData,
  } = useApp();

  // Track recent decisions so the row stays visible briefly with status
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  // Copointo system broadcasts from super-admin
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  // Held free coffees (earned-but-still-redeemable) for this signed-in phone
  const [freeCoffees, setFreeCoffees] = useState<FreeCoffeeNotif[]>([]);

  const loadBroadcasts = useCallback(async () => {
    try {
      const r = await apiFetch<{ broadcasts: Broadcast[] }>("/broadcasts");
      setBroadcasts(r.broadcasts ?? []);
      // Mark as seen so the bell badge clears.
      const newest = r.broadcasts?.[0]?.createdAt;
      if (newest) await AsyncStorage.setItem(BROADCAST_LAST_SEEN_KEY, newest);
    } catch {
      /* ignore network errors — show whatever is cached */
    }
  }, []);

  const loadFreeCoffees = useCallback(async () => {
    const phone = user?.phone?.trim();
    if (!phone) { setFreeCoffees([]); return; }
    try {
      const r = await apiFetch<{ coffees: FreeCoffeeNotif[] }>(
        `/free-coffees?phone=${encodeURIComponent(phone)}`,
      );
      // Show only currently-redeemable ones (unredeemed) — newest first.
      const open = (r.coffees ?? [])
        .filter(c => !c.redeemedAt)
        .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
      setFreeCoffees(open);
      // Mark as seen so the bell badge clears.
      const newest = open[0]?.earnedAt;
      if (newest) await AsyncStorage.setItem(FREE_COFFEE_LAST_SEEN_KEY, newest);
    } catch {
      /* ignore */
    }
  }, [user?.phone]);

  useEffect(() => { loadBroadcasts(); loadFreeCoffees(); }, [loadBroadcasts, loadFreeCoffees]);

  // Whenever this screen comes into focus, re-pull friend/request data from
  // storage in case another logged-in user on the same device sent something.
  useFocusEffect(
    useCallback(() => {
      refreshFriendData();
      loadBroadcasts();
      loadFreeCoffees();
    }, [refreshFriendData, loadBroadcasts, loadFreeCoffees])
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
        {rows.length === 0 && recentlyDecided.length === 0 && broadcasts.length === 0 && freeCoffees.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
            <Text style={styles.emptySub}>
              عندما يرسل لك أحد طلب صداقة سيظهر هنا
            </Text>
          </View>
        )}

        {/* Free coffees the user has earned but not yet redeemed */}
        {freeCoffees.map(c => (
          <View key={`fc-${c.id}`} style={styles.freeCoffeeCard}>
            <View style={styles.freeCoffeeHeader}>
              <View style={styles.freeCoffeeBadge}>
                <Text style={styles.freeCoffeeBadgeIcon}>🎁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.freeCoffeeTitle}>حصلت على كوفي مجاني!</Text>
                <Text style={styles.freeCoffeeTime}>
                  {fmtRelative(c.earnedAt)}  •  مكافأة مستوى {c.earnedAtLevel}
                </Text>
              </View>
            </View>
            <Text style={styles.freeCoffeeBody}>
              {c.earnedAtCafeName
                ? `قابل للاستبدال في ${c.earnedAtCafeName}`
                : "قابل للاستبدال في الكوفي الذي حصلت منه على المكافأة"}
            </Text>
            <View style={styles.freeCoffeeRulesBox}>
              <Text style={styles.freeCoffeeRule}>• مشروبات فقط (لا أطعمة أو حلى)</Text>
              <Text style={styles.freeCoffeeRule}>• سعر المشروب ≤ 2 ر.ع.</Text>
              <Text style={styles.freeCoffeeRule}>• استخدم مرة واحدة عند الطلب التالي</Text>
            </View>
            <View style={styles.freeCoffeeCodeBox}>
              <Text style={styles.freeCoffeeCodeLabel}>الرمز</Text>
              <Text style={styles.freeCoffeeCode}>{c.code}</Text>
            </View>
          </View>
        ))}

        {/* Copointo system broadcasts */}
        {broadcasts.map(b => (
          <View key={`bc-${b.id}`} style={styles.broadcastCard}>
            <View style={styles.broadcastHeader}>
              <View style={styles.broadcastBadge}>
                <Text style={styles.broadcastBadgeIcon}>📣</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.broadcastTitleRow}>
                  <Text style={styles.broadcastSender}>Copointo</Text>
                  <View style={styles.officialDot} />
                  <Text style={styles.broadcastOfficial}>رسمي</Text>
                </View>
                <Text style={styles.broadcastTime}>{fmtRelative(b.createdAt)}</Text>
              </View>
            </View>
            <Text style={styles.broadcastBody}>{b.message}</Text>
          </View>
        ))}

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
                  <Feather name="x" size={15} color="#E8B86D" />
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
  // Broadcast (system message from Copointo)
  broadcastCard: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: ACCENT,
    gap: 12,
  },
  broadcastHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  broadcastBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  broadcastBadgeIcon: { fontSize: 22 },
  broadcastTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  broadcastSender: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  officialDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ACCENT },
  broadcastOfficial: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: ACCENT },
  broadcastTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", marginTop: 2 },
  broadcastBody: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#FFF", lineHeight: 22 },

  // Free-coffee earned notification
  freeCoffeeCard: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: ACCENT,
    gap: 12,
  },
  freeCoffeeHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  freeCoffeeBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(232,184,109,0.18)",
    borderWidth: 1, borderColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  freeCoffeeBadgeIcon: { fontSize: 24 },
  freeCoffeeTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: ACCENT },
  freeCoffeeTime:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 2 },
  freeCoffeeBody:  { fontSize: 13, fontFamily: "Inter_500Medium", color: "#FFF", lineHeight: 20 },
  freeCoffeeRulesBox: {
    backgroundColor: "rgba(232,184,109,0.06)",
    borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.20)",
    paddingVertical: 10, paddingHorizontal: 12,
    gap: 4,
  },
  freeCoffeeRule:  { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.78)", lineHeight: 18 },
  freeCoffeeCodeBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  freeCoffeeCodeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#000" },
  freeCoffeeCode: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000", letterSpacing: 2 },

  emptyWrap: { alignItems: "center", paddingTop: 100, gap: 10 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.50)",
    textAlign: "center", paddingHorizontal: 32,
  },
});
