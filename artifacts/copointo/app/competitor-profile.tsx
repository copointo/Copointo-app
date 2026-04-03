import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getRank } from "@/data/mockData";

const BG = "#0F0A2E";

// Mock cafe orders per competitor (keyed by username)
const CAFE_ORDERS: Record<string, { cafe: string; count: number; city: string }[]> = {
  mohammed_h: [
    { cafe: "Karak House",       count: 18, city: "مسقط" },
    { cafe: "Coffee Story",      count: 12, city: "مسقط" },
    { cafe: "Blend Café",        count: 7,  city: "صلالة" },
    { cafe: "The Roastery",      count: 5,  city: "صحار"  },
  ],
  khalid_r: [
    { cafe: "Mystic Brew",       count: 22, city: "مسقط" },
    { cafe: "Karak House",       count: 9,  city: "مسقط" },
    { cafe: "Qahwa Corner",      count: 6,  city: "نزوى"  },
  ],
  sara_z: [
    { cafe: "Blend Café",        count: 14, city: "صلالة" },
    { cafe: "Coffee Story",      count: 11, city: "مسقط" },
    { cafe: "Morning Cup",       count: 4,  city: "مسقط" },
  ],
  oman_1: [
    { cafe: "Karak House",       count: 95, city: "مسقط" },
    { cafe: "Coffee Story",      count: 78, city: "مسقط" },
    { cafe: "Blend Café",        count: 61, city: "صلالة" },
    { cafe: "The Roastery",      count: 44, city: "صحار"  },
    { cafe: "Mystic Brew",       count: 38, city: "مسقط" },
    { cafe: "Qahwa Corner",      count: 29, city: "نزوى"  },
  ],
  coffee_m: [
    { cafe: "The Roastery",      count: 88, city: "صحار"  },
    { cafe: "Karak House",       count: 72, city: "مسقط" },
    { cafe: "Mystic Brew",       count: 55, city: "مسقط" },
    { cafe: "Blend Café",        count: 40, city: "صلالة" },
  ],
  top_tier: [
    { cafe: "Coffee Story",      count: 80, city: "مسقط" },
    { cafe: "Karak House",       count: 65, city: "مسقط" },
    { cafe: "Morning Cup",       count: 50, city: "مسقط" },
  ],
};

// Match competitor id → username → data
const COMPETITOR_DATA: Record<string, {
  name: string; username: string; level: number; omanRank: number; avatar: string;
}> = {
  mohammed_h: { name: "Mohammed Al-Habsi", username: "mohammed_h", level: 45,  omanRank: 24,  avatar: "👤" },
  khalid_r:   { name: "Khalid Mansoor",    username: "khalid_r",   level: 38,  omanRank: 41,  avatar: "👤" },
  sara_z:     { name: "Sara Al-Zahra",     username: "sara_z",     level: 31,  omanRank: 63,  avatar: "👤" },
  oman_1:     { name: "Oman #1",           username: "oman_1",     level: 980, omanRank: 1,   avatar: "🏆" },
  coffee_m:   { name: "Coffee Master",     username: "coffee_m",   level: 901, omanRank: 2,   avatar: "☕" },
  top_tier:   { name: "Top Tier",          username: "top_tier",   level: 867, omanRank: 3,   avatar: "🌟" },
};

export default function CompetitorProfileScreen() {
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { id }      = useLocalSearchParams<{ id: string }>();
  const topPad      = Platform.OS === "web" ? 67 : insets.top;

  const data        = COMPETITOR_DATA[id ?? ""] ?? null;
  const cafeOrders  = CAFE_ORDERS[id ?? ""] ?? [];
  const rank        = data ? getRank(data.level) : null;
  const tierColor   = rank ? "#E8B86D" : "#E8B86D";

  if (!data) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.centerWrap}>
          <Text style={styles.emptyText}>لا توجد بيانات</Text>
        </View>
      </View>
    );
  }

  const totalCoffees = cafeOrders.reduce((s, c) => s + c.count, 0);

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
          {/* Avatar */}
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 52 }}>{data.avatar}</Text>
          </View>

          {/* Name + username */}
          <Text style={styles.displayName}>{data.name}</Text>
          <Text style={styles.username}>@{data.username}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>#{data.omanRank}</Text>
              <Text style={styles.statLabel}>تصنيف عُمان</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#E8B86D" }]}>{data.level}</Text>
              <Text style={styles.statLabel}>المستوى</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#4FC3F7" }]}>{totalCoffees}</Text>
              <Text style={styles.statLabel}>إجمالي القهوة</Text>
            </View>
          </View>

          {/* Rank badge */}
          <View style={[styles.rankBadge, { borderColor: "#E8B86D55" }]}>
            <Text style={styles.rankBadgeIcon}>{rank?.icon}</Text>
            <Text style={[styles.rankBadgeName, { color: "#E8B86D" }]}>{rank?.name}</Text>
          </View>
        </View>

        {/* Cafe orders section */}
        <Text style={styles.sectionTitle}>☕ القهوات من كل مقهى في عُمان</Text>

        {cafeOrders.length === 0 ? (
          <View style={styles.centerWrap}>
            <Text style={styles.emptyText}>لا توجد بيانات</Text>
          </View>
        ) : (
          <View style={styles.cafeList}>
            {cafeOrders
              .sort((a, b) => b.count - a.count)
              .map((item, i) => {
                const maxCount = cafeOrders[0].count;
                const pct      = (item.count / maxCount) * 100;
                return (
                  <View key={i} style={styles.cafeRow}>
                    <View style={styles.cafeLeft}>
                      <Text style={styles.cafeRank}>#{i + 1}</Text>
                      <View>
                        <Text style={styles.cafeName}>{item.cafe}</Text>
                        <Text style={styles.cafeCity}>{item.city}</Text>
                      </View>
                    </View>
                    <View style={styles.cafeRight}>
                      {/* Mini bar */}
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` as any }]} />
                      </View>
                      <Text style={styles.cafeCount}>{item.count} ☕</Text>
                    </View>
                  </View>
                );
              })}
          </View>
        )}
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
  sectionTitle: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF",
    marginHorizontal: 20, marginBottom: 12,
  },
  cafeList: { marginHorizontal: 16, gap: 10 },
  cafeRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  cafeLeft:  { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  cafeRank:  { fontSize: 13, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.35)", width: 24 },
  cafeName:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  cafeCity:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)" },
  cafeRight: { alignItems: "flex-end", gap: 5, minWidth: 80 },
  barTrack:  { width: 80, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.10)" },
  barFill:   { height: "100%", borderRadius: 2, backgroundColor: "#E8B86D" },
  cafeCount: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#E8B86D" },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.35)" },
});
