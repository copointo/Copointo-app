import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

type LeaderTab = "friends" | "oman";

const LEADERBOARD: Record<LeaderTab, { name: string; level: number; isMe?: boolean; isFriend?: boolean }[]> = {
  friends: [
    { name: "Mohammed Al-Habsi", level: 45, isFriend: true },
    { name: "Ahmed (You)", level: 42, isMe: true },
    { name: "Khalid Mansoor", level: 38, isFriend: true },
    { name: "Sara Al-Zahra", level: 31, isFriend: true },
  ],
  oman: [
    { name: "Oman #1", level: 980 },
    { name: "Coffee Master", level: 901 },
    { name: "Top Tier", level: 867 },
    { name: "Ahmed (You)", level: 42, isMe: true },
  ],
};

const TAB_LABELS: Record<LeaderTab, string> = {
  friends: "👥 الأصدقاء",
  oman: "🇴🇲 عُمان",
};

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<LeaderTab>("friends");
  const [addedFriends, setAddedFriends] = useState<string[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleAddFriend = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddedFriends((prev) => [...prev, name]);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏆 Leaderboard</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(Object.keys(TAB_LABELS) as LeaderTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab);
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Entries */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {LEADERBOARD[activeTab].map((entry, i) => {
          const isAdded = addedFriends.includes(entry.name);
          const rankInfo = getRank(entry.level);
          return (
            <View
              key={i}
              style={[
                styles.entryRow,
                entry.isMe && styles.entryRowMe,
                i === 0 && styles.entryRowFirst,
              ]}
            >
              <Text style={[
                styles.entryRankNum,
                { color: i === 0 ? "#FFD700" : i === 1 ? "#A8A8A8" : i === 2 ? "#CD7F32" : "#999" },
              ]}>
                {MEDAL[i] ?? `#${i + 1}`}
              </Text>

              <View style={[styles.avatar, entry.isMe && { backgroundColor: "#FDDCBA" }]}>
                <Text style={{ fontSize: 20 }}>{entry.isMe ? "😊" : "👤"}</Text>
              </View>

              <View style={styles.entryInfo}>
                <Text style={[styles.entryName, entry.isMe && { color: "#C67C4E" }]}>
                  {entry.name}
                </Text>
                <Text style={styles.entryLevel}>
                  Level {entry.level} · {rankInfo.nameEn} {rankInfo.icon}
                </Text>
              </View>

              {!entry.isMe && !entry.isFriend && (
                <TouchableOpacity
                  style={[styles.addBtn, isAdded && styles.addBtnDone]}
                  onPress={() => !isAdded && handleAddFriend(entry.name)}
                  activeOpacity={0.85}
                >
                  <Feather name={isAdded ? "check" : "user-plus"} size={14} color="#FFF" />
                </TouchableOpacity>
              )}
              {entry.isFriend && !entry.isMe && (
                <View style={styles.friendTag}>
                  <Text style={styles.friendTagText}>Friend</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1C3B1E" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    flex: 1, fontSize: 20,
    fontFamily: "Inter_700Bold", color: "#FFF",
  },
  tabsRow: {
    flexDirection: "row",
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16, padding: 4, gap: 2,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9,
    borderRadius: 12, alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#FFF" },
  tabText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.65)",
  },
  tabTextActive: { color: "#C67C4E" },
  list: { flex: 1 },
  entryRow: {
    flexDirection: "row", alignItems: "center",
    gap: 12, padding: 14, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  entryRowMe: {
    backgroundColor: "rgba(198,124,78,0.2)", borderColor: "#C67C4E",
  },
  entryRowFirst: {
    borderColor: "rgba(255,215,0,0.4)", backgroundColor: "rgba(255,215,0,0.08)",
  },
  entryRankNum: {
    fontSize: 20, fontFamily: "Inter_700Bold",
    width: 32, textAlign: "center",
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  entryInfo: { flex: 1 },
  entryName: {
    fontSize: 14, fontFamily: "Inter_600SemiBold",
    color: "#FFF", marginBottom: 3,
  },
  entryLevel: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  addBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#C67C4E",
    alignItems: "center", justifyContent: "center",
  },
  addBtnDone: { backgroundColor: "#4CAF50" },
  friendTag: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)",
  },
  friendTagText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
  },
});
