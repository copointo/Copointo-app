import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Image,
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

const BG = "#000000";

export default function CompetitorProfileScreen() {
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { id }      = useLocalSearchParams<{ id: string }>();
  const topPad      = Platform.OS === "web" ? 67 : insets.top;
  const {
    registeredUsers, friends,
    outgoingRequests, incomingRequests,
    sendFriendRequest, cancelFriendRequest, acceptFriendRequest,
    user: currentUser,
  } = useApp();

  // id is the gameUsername (set by leaderboard route)
  const target = useMemo(() => {
    if (!id) return null;
    return registeredUsers.find(
      u => u.gameUsername.toLowerCase() === id.toLowerCase()
    ) ?? null;
  }, [id, registeredUsers]);

  const omanRank = useMemo(() => {
    if (!target) return null;
    const sorted = [...registeredUsers].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const idx = sorted.findIndex(u => u.id === target.id);
    return idx >= 0 ? idx + 1 : null;
  }, [target, registeredUsers]);

  const isFriend    = !!(target && friends.includes(target.id));
  const isPending   = !!(target && outgoingRequests.includes(target.id));
  const hasIncoming = !!(target && incomingRequests.includes(target.id));
  const isMe        = !!(target && currentUser?.id === target.id);
  const rank        = target ? getRank(target.level) : null;

  if (!target) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الملف الشخصي</Text>
        </View>
        <View style={styles.centerWrap}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyText}>المستخدم غير موجود</Text>
        </View>
      </View>
    );
  }

  const handleSend = () => {
    if (!target) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendFriendRequest(target.id);
  };
  const handleCancel = () => {
    if (!target) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelFriendRequest(target.id);
  };
  const handleAccept = () => {
    if (!target) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    acceptFriendRequest(target.id);
  };

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
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          {target.avatar ? (
            <Image source={{ uri: target.avatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 52 }}>
                {target.gender === "female" ? "👩" : target.gender === "male" ? "🧑" : "👤"}
              </Text>
            </View>
          )}

          <Text style={styles.displayName}>{target.name}</Text>
          <Text style={styles.username}>@{target.gameUsername}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{omanRank ? `#${omanRank}` : "—"}</Text>
              <Text style={styles.statLabel}>تصنيف عُمان</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#E8B86D" }]}>{target.level}</Text>
              <Text style={styles.statLabel}>المستوى</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#4FC3F7" }]}>{target.totalOrders ?? 0}</Text>
              <Text style={styles.statLabel}>إجمالي القهوة</Text>
            </View>
          </View>

          {/* Rank badge */}
          <View style={[styles.rankBadge, { borderColor: "#E8B86D55" }]}>
            <Text style={styles.rankBadgeIcon}>{rank?.icon}</Text>
            <Text style={[styles.rankBadgeName, { color: "#E8B86D" }]}>{rank?.name}</Text>
          </View>

          {/* Friend-request actions */}
          {!isMe && currentUser && (
            <>
              {isFriend && (
                <View style={[styles.addFriendBtn, { backgroundColor: "#4CAF50" }]}>
                  <Feather name="check" size={16} color="#FFF" />
                  <Text style={[styles.addFriendText, { color: "#FFF" }]}>صديق</Text>
                </View>
              )}
              {!isFriend && hasIncoming && (
                <TouchableOpacity
                  style={[styles.addFriendBtn, { backgroundColor: "#4CAF50" }]}
                  onPress={handleAccept}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={16} color="#FFF" />
                  <Text style={[styles.addFriendText, { color: "#FFF" }]}>قبول الطلب</Text>
                </TouchableOpacity>
              )}
              {!isFriend && !hasIncoming && isPending && (
                <TouchableOpacity
                  style={[
                    styles.addFriendBtn,
                    {
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: "#E8B86D",
                      borderStyle: "dashed",
                    },
                  ]}
                  onPress={handleCancel}
                  activeOpacity={0.85}
                >
                  <Feather name="clock" size={16} color="#E8B86D" />
                  <Text style={[styles.addFriendText, { color: "#E8B86D" }]}>طلب معلّق · إلغاء</Text>
                </TouchableOpacity>
              )}
              {!isFriend && !hasIncoming && !isPending && (
                <TouchableOpacity style={styles.addFriendBtn} onPress={handleSend} activeOpacity={0.85}>
                  <Feather name="user-plus" size={16} color="#0F0A2E" />
                  <Text style={styles.addFriendText}>إضافة صديق</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Activity placeholder */}
        <Text style={styles.sectionTitle}>☕ النشاط</Text>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>
            {(target.totalOrders ?? 0) > 0
              ? `${target.totalOrders} طلب حتى الآن`
              : "لم يبدأ هذا المستخدم بطلب القهوة بعد"}
          </Text>
        </View>
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
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },
  profileCard: {
    marginHorizontal: 16, marginBottom: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 24, padding: 24,
    alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  avatarImg: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.20)",
    marginBottom: 4,
  },
  displayName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },
  username:    { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)" },
  statsRow: {
    flexDirection: "row", marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, padding: 14, gap: 0,
    width: "100%",
  },
  statBox: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)" },
  rankBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: "rgba(232,184,109,0.08)", marginTop: 4,
  },
  rankBadgeIcon: { fontSize: 18 },
  rankBadgeName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addFriendBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#E8B86D",
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 14, marginTop: 8,
  },
  addFriendText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F0A2E" },
  sectionTitle: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF",
    marginHorizontal: 20, marginBottom: 12,
  },
  placeholderCard: {
    marginHorizontal: 16, padding: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)", textAlign: "center",
  },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.35)" },
});
