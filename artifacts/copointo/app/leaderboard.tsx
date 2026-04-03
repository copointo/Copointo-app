import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getRank } from "@/data/mockData";

type LeaderTab = "friends" | "city" | "oman" | "world";

const LEADERBOARD: Record<LeaderTab, { name: string; level: number; isMe?: boolean; isFriend?: boolean }[]> = {
  friends: [
    { name: "Mohammed Al-Habsi", level: 45, isFriend: true },
    { name: "Ahmed (You)", level: 42, isMe: true },
    { name: "Khalid Mansoor", level: 38, isFriend: true },
    { name: "Sara Al-Zahra", level: 31, isFriend: true },
  ],
  city: [
    { name: "Muscat Champion", level: 892 },
    { name: "City King", level: 743 },
    { name: "Coffee Lover", level: 621 },
    { name: "Ahmed (You)", level: 42, isMe: true },
  ],
  oman: [
    { name: "Oman #1", level: 980 },
    { name: "Coffee Master", level: 901 },
    { name: "Top Tier", level: 867 },
    { name: "Ahmed (You)", level: 42, isMe: true },
  ],
  world: [
    { name: "World Champion", level: 999 },
    { name: "Global Hero", level: 998 },
    { name: "Legend Player", level: 995 },
    { name: "Ahmed (You)", level: 42, isMe: true },
  ],
};

const TAB_LABELS: Record<LeaderTab, string> = {
  friends: "👥 Friends",
  city: "🏙️ City",
  oman: "🇴🇲 Oman",
  world: "🌍 World",
};

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<LeaderTab>("friends");
  const [showAddByUser, setShowAddByUser] = useState(false);
  const [username, setUsername] = useState("");
  const [addedFriends, setAddedFriends] = useState<string[]>([]);
  const [notifications, setNotifications] = useState([
    { id: "1", text: "Mohammed accepted your request", time: "2m ago", read: false },
    { id: "2", text: "Sara started following you", time: "1h ago", read: false },
    { id: "3", text: "You reached Level 42!", time: "3h ago", read: true },
  ]);
  const [showNotifs, setShowNotifs] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleAddFriend = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddedFriends((prev) => [...prev, name]);
    Alert.alert("Friend Request Sent", `Request sent to ${name}!`);
  };

  const handleSearchAdd = () => {
    if (!username.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Request Sent", `Friend request sent to @${username.trim()}`);
    setUsername("");
    setShowAddByUser(false);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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

        <View style={styles.headerActions}>
          {/* Notifications */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              Haptics.selectionAsync();
              setShowNotifs((v) => !v);
              setShowAddByUser(false);
            }}
            activeOpacity={0.8}
          >
            <Feather name="bell" size={20} color="#FFF" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Add by username */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "#C67C4E" }]}
            onPress={() => {
              Haptics.selectionAsync();
              setShowAddByUser((v) => !v);
              setShowNotifs(false);
            }}
            activeOpacity={0.8}
          >
            <Feather name="user-plus" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Panel */}
      {showNotifs && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Notifications</Text>
            <TouchableOpacity onPress={markAllRead}>
              <Text style={styles.markRead}>Mark all read</Text>
            </TouchableOpacity>
          </View>
          {notifications.map((n) => (
            <View key={n.id} style={[styles.notifRow, n.read && { opacity: 0.5 }]}>
              <View style={[styles.notifDot, { backgroundColor: n.read ? "#DDD" : "#C67C4E" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.notifText}>{n.text}</Text>
                <Text style={styles.notifTime}>{n.time}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add by username Panel */}
      {showAddByUser && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Add Friend by Username</Text>
          <View style={styles.searchRow}>
            <View style={styles.usernameInput}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={styles.usernameField}
                placeholder="Enter username..."
                placeholderTextColor="#AAA"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleSearchAdd}
              />
            </View>
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSearchAdd}
              activeOpacity={0.85}
            >
              <Feather name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

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
              {/* Rank */}
              <Text style={[
                styles.entryRankNum,
                { color: i === 0 ? "#FFD700" : i === 1 ? "#A8A8A8" : i === 2 ? "#CD7F32" : "#999" },
              ]}>
                {MEDAL[i] ?? `#${i + 1}`}
              </Text>

              {/* Avatar */}
              <View style={[styles.avatar, entry.isMe && { backgroundColor: "#FDDCBA" }]}>
                <Text style={{ fontSize: 20 }}>{entry.isMe ? "😊" : "👤"}</Text>
              </View>

              {/* Info */}
              <View style={styles.entryInfo}>
                <Text style={[styles.entryName, entry.isMe && { color: "#C67C4E" }]}>
                  {entry.name}
                </Text>
                <Text style={styles.entryLevel}>
                  Level {entry.level} · {rankInfo.nameEn} {rankInfo.icon}
                </Text>
              </View>

              {/* Add button */}
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
  container: {
    flex: 1,
    backgroundColor: "#1C3B1E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#C67C4E",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  panel: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1C1C1C",
  },
  markRead: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#C67C4E",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  notifText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#1C1C1C",
    marginBottom: 2,
  },
  notifTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#999",
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  usernameInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  atSign: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#C67C4E",
  },
  usernameField: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#1C1C1C",
    padding: 0,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#C67C4E",
    alignItems: "center",
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 4,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#FFF",
  },
  tabText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.65)",
  },
  tabTextActive: {
    color: "#C67C4E",
  },
  list: {
    flex: 1,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  entryRowMe: {
    backgroundColor: "rgba(198,124,78,0.2)",
    borderColor: "#C67C4E",
  },
  entryRowFirst: {
    borderColor: "rgba(255,215,0,0.4)",
    backgroundColor: "rgba(255,215,0,0.08)",
  },
  entryRankNum: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    width: 32,
    textAlign: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
    marginBottom: 3,
  },
  entryLevel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#C67C4E",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnDone: {
    backgroundColor: "#4CAF50",
  },
  friendTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  friendTagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
  },
});
