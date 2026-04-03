import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { RankBadge } from "@/components/RankBadge";
import { useApp } from "@/context/AppContext";
import { getRank } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={{ fontSize: 24 }}>{icon}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useApp();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? "");

  const level = user?.level ?? 1;
  const rank = getRank(level);
  const nextRank = level < 1000 ? getRank(Math.min(level + 100, 1000)) : null;
  const levelProgress = ((level % 100) / 100) * 100;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleSave = () => {
    if (editName.trim() && user) {
      setUser({ ...user, name: editName.trim() });
    }
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const MENU_ITEMS = [
    { icon: "shopping-bag", label: "Order History", badge: user?.totalOrders.toString() },
    { icon: "heart", label: "Favorite Cafes", badge: "4" },
    { icon: "bell", label: "Notifications", badge: null },
    { icon: "settings", label: "Settings", badge: null },
    { icon: "help-circle", label: "Help & Support", badge: null },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        <TouchableOpacity
          onPress={() => {
            setEditing(!editing);
            if (!editing) setEditName(user?.name ?? "");
          }}
          style={[styles.editBtn, { backgroundColor: editing ? colors.primary : colors.secondary }]}
        >
          <Feather
            name={editing ? "x" : "edit-2"}
            size={16}
            color={editing ? colors.primaryForeground : colors.secondaryForeground}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: Platform.OS === "web" ? 110 : 100 }]}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatarCircle, { backgroundColor: rank.color + "20", borderColor: rank.color }]}>
            <Text style={styles.avatarText}>
              {user?.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                placeholder="Your name"
                placeholderTextColor={colors.mutedForeground}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Feather name="check" size={18} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
          )}

          <RankBadge level={level} size="md" />
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Level" value={level.toString()} icon="⭐" />
          <StatCard label="Orders" value={(user?.totalOrders ?? 0).toString()} icon="☕" />
          <StatCard label="Points" value={(user?.points ?? 0).toLocaleString()} icon="🏆" />
        </View>

        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.foreground }]}>
              Level Progress
            </Text>
            {nextRank && (
              <Text style={[styles.nextRank, { color: colors.mutedForeground }]}>
                Next: {nextRank.nameEn} {nextRank.icon}
              </Text>
            )}
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${levelProgress}%` as any, backgroundColor: rank.color },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
            {level} / {rank.max} — {rank.max - level} levels to next rank
          </Text>
        </View>

        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.85}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                <Feather name={item.icon as any} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
              <View style={styles.menuRight}>
                {item.badge && (
                  <View style={[styles.menuBadge, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[styles.menuBadgeText, { color: colors.primary }]}>
                      {item.badge}
                    </Text>
                  </View>
                )}
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: 20, gap: 16 },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#C47B2B",
  },
  editRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    width: "100%",
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  progressCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nextRank: { fontSize: 13, fontFamily: "Inter_400Regular" },
  progressBar: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 5 },
  progressText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  menuSection: { gap: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  menuBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
