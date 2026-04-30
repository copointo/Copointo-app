import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { useApp, type User } from "@/context/AppContext";
import { getRank } from "@/data/mockData";

type LeaderTab = "friends" | "oman";

const TAB_LABELS: Record<LeaderTab, string> = {
  friends: "👥 الأصدقاء",
  oman: "🇴🇲 عُمان",
};

const MEDAL = ["🥇", "🥈", "🥉"];

interface Entry {
  id: string;
  name: string;
  username: string;
  level: number;
  isMe: boolean;
  isFriend: boolean;
  isPending: boolean;
  hasIncoming: boolean;
  avatar?: string;
  gender?: "male" | "female";
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user, registeredUsers, friends,
    outgoingRequests, incomingRequests,
    sendFriendRequest, cancelFriendRequest,
  } = useApp();
  const [activeTab, setActiveTab] = useState<LeaderTab>("friends");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const toEntry = (u: User): Entry => ({
    id: u.id,
    name: u.name,
    username: u.gameUsername,
    level: u.level,
    isMe: u.id === user?.id,
    isFriend: friends.includes(u.id),
    isPending: outgoingRequests.includes(u.id),
    hasIncoming: incomingRequests.includes(u.id),
    avatar: u.avatar,
    gender: u.gender,
  });

  const sortDesc = (a: Entry, b: Entry) => b.level - a.level;

  const entries = useMemo<Entry[]>(() => {
    if (activeTab === "oman") {
      return registeredUsers.map(toEntry).sort(sortDesc);
    }
    // friends tab: friends + me, but only if user has at least one friend
    if (friends.length === 0) return [];
    return registeredUsers
      .filter(u => friends.includes(u.id) || u.id === user?.id)
      .map(toEntry)
      .sort(sortDesc);
    // Note: outgoingRequests / incomingRequests are intentionally part of
    // the dep list so the +/⏳/✓ button states re-render when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, registeredUsers, friends, user?.id, outgoingRequests, incomingRequests]);

  const handleSendRequest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendFriendRequest(id);
  };

  const handleCancelRequest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelFriendRequest(id);
  };

  const openProfile = (username: string) => {
    if (!username) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/competitor-profile?id=${username}`);
  };

  const emptyMsg = activeTab === "friends"
    ? "لا يوجد أصدقاء بعد"
    : "لا يوجد مستخدمون في عُمان بعد";
  const emptySub = activeTab === "friends"
    ? "أضف أصدقاءك من تبويب «عُمان» لتنافسهم هنا"
    : "كن أول من يبدأ رحلة القهوة!";

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
        {entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🏁</Text>
            <Text style={styles.emptyTitle}>{emptyMsg}</Text>
            <Text style={styles.emptySub}>{emptySub}</Text>
          </View>
        ) : entries.map((entry, i) => {
          const rankInfo = getRank(entry.level);
          return (
            <View
              key={entry.id}
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

              {entry.avatar ? (
                <Image source={{ uri: entry.avatar }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatar, entry.isMe && { backgroundColor: "rgba(232,184,109,0.30)" }]}>
                  <Text style={{ fontSize: 20 }}>
                    {entry.gender === "female" ? "👩" : entry.gender === "male" ? "🧑" : "👤"}
                  </Text>
                </View>
              )}

              <View style={styles.entryInfo}>
                <Text style={[styles.entryName, entry.isMe && { color: "#E8B86D" }]}>
                  {entry.name}{entry.isMe ? " (أنت)" : ""}
                </Text>
                <Text style={styles.entryLevel}>
                  Level {entry.level} · {rankInfo.nameEn} {rankInfo.icon}
                </Text>
              </View>

              {/* Profile button */}
              {!entry.isMe && entry.username && (
                <TouchableOpacity
                  style={styles.profileBtn}
                  onPress={() => openProfile(entry.username)}
                  activeOpacity={0.8}
                >
                  <Feather name="user" size={15} color="#FFF" />
                </TouchableOpacity>
              )}

              {!entry.isMe && !entry.isFriend && !entry.isPending && !entry.hasIncoming && (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => handleSendRequest(entry.id)}
                  activeOpacity={0.85}
                >
                  <Feather name="user-plus" size={14} color="#000" />
                </TouchableOpacity>
              )}
              {!entry.isMe && !entry.isFriend && entry.hasIncoming && (
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: "#7DD87D" }]}
                  onPress={() => handleSendRequest(entry.id)}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={14} color="#000" />
                </TouchableOpacity>
              )}
              {!entry.isMe && !entry.isFriend && entry.isPending && (
                <TouchableOpacity
                  style={styles.pendingTag}
                  onPress={() => handleCancelRequest(entry.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pendingTagText}>⏳ معلّق</Text>
                </TouchableOpacity>
              )}
              {entry.isFriend && !entry.isMe && (
                <View style={styles.friendTag}>
                  <Text style={styles.friendTagText}>صديق</Text>
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
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "#0A0606", borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    flex: 1, fontSize: 20,
    fontFamily: "Inter_700Bold", color: "#FFF",
  },
  tabsRow: {
    flexDirection: "row",
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "rgba(232,184,109,0.08)",
    borderRadius: 16, padding: 4, gap: 2,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9,
    borderRadius: 12, alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#E8B86D" },
  tabText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.65)",
  },
  tabTextActive: { color: "#000000" },
  list: { flex: 1 },
  entryRow: {
    flexDirection: "row", alignItems: "center",
    gap: 12, padding: 14, borderRadius: 18,
    backgroundColor: "#0A0606",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  entryRowMe: {
    backgroundColor: "rgba(232,184,109,0.10)", borderColor: "#E8B86D",
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
    backgroundColor: "#0A0606", borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  avatarImg: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.20)",
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
    backgroundColor: "#E8B86D",
    alignItems: "center", justifyContent: "center",
  },
  profileBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#0A0606", borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  friendTag: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, backgroundColor: "#0A0606", borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
  },
  friendTagText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
  },
  pendingTag: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.40)",
    borderStyle: "dashed",
  },
  pendingTagText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "#E8B86D",
  },
  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.50)",
    textAlign: "center", paddingHorizontal: 32,
  },
});
