import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MESSAGES, Message } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

function ConversationItem({ msg }: { msg: Message }) {
  const colors = useColors();
  const isCafe = msg.type === "cafe";

  return (
    <TouchableOpacity
      style={[styles.convItem, { borderBottomColor: colors.border }]}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: isCafe ? colors.primary + "22" : colors.secondary,
            borderColor: isCafe ? colors.primary : colors.border,
          },
        ]}
      >
        <Text style={styles.avatarEmoji}>{isCafe ? "☕" : "👤"}</Text>
      </View>
      <View style={styles.convContent}>
        <View style={styles.convHeader}>
          <Text style={[styles.senderName, { color: colors.foreground }]}>
            {msg.senderName}
          </Text>
          <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
            {msg.timestamp}
          </Text>
        </View>
        <View style={styles.convFooter}>
          <Text
            style={[
              styles.preview,
              {
                color: msg.unread > 0 ? colors.foreground : colors.mutedForeground,
                fontFamily: msg.unread > 0 ? "Inter_500Medium" : "Inter_400Regular",
              },
            ]}
            numberOfLines={1}
          >
            {msg.preview}
          </Text>
          {msg.unread > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.unreadText, { color: colors.primaryForeground }]}>
                {msg.unread}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const filtered = MESSAGES.filter(
    (m) =>
      !search ||
      m.senderName.toLowerCase().includes(search.toLowerCase()) ||
      m.preview.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
        <TouchableOpacity
          style={[styles.composeBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="edit-2" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search messages..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, { borderBottomColor: colors.primary }]}>
          <Text style={[styles.tabText, { color: colors.primary }]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={[styles.tabText, { color: colors.mutedForeground }]}>Cafes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={[styles.tabText, { color: colors.mutedForeground }]}>Friends</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ConversationItem msg={item} />}
        contentContainerStyle={{ paddingBottom: bottomPadding + 80 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No messages yet
            </Text>
          </View>
        }
        scrollEnabled={filtered.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  composeBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 4,
    gap: 24,
  },
  tab: {
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  convItem: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    alignItems: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 22,
  },
  convContent: {
    flex: 1,
  },
  convHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  senderName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  timestamp: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  convFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  preview: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});
