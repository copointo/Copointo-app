import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";

const BG = "#0F0A2E";
const ACCENT = "#E8B86D";

export default function AddFriendScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 67 : insets.top;
  const { user, registeredUsers, friends, addFriend } = useApp();

  const [query, setQuery] = useState("");

  // Show all OTHER registered users (excluding self), filtered by query
  const candidates = useMemo(() => {
    const others = registeredUsers.filter(u => u.id !== user?.id);
    if (!query.trim()) return others;
    const q = query.toLowerCase();
    return others.filter(
      u => u.name.toLowerCase().includes(q) || u.gameUsername.toLowerCase().includes(q)
    );
  }, [registeredUsers, user?.id, query]);

  const sendRequest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addFriend(id);
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
        <Text style={styles.headerTitle}>إضافة صديق</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={18} color={ACCENT} style={{ marginLeft: 14 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث بالاسم أو يوزر اللعبة..."
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} style={{ marginRight: 14 }}>
            <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Section label */}
      <Text style={styles.sectionLabel}>
        {query.trim() ? "نتائج البحث" : "المستخدمون"}
      </Text>

      {/* Results */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {candidates.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>{query.trim() ? "🔍" : "👥"}</Text>
            <Text style={styles.emptyText}>
              {query.trim() ? "لا توجد نتائج" : "لا يوجد مستخدمون آخرون بعد"}
            </Text>
          </View>
        ) : (
          candidates.map((s) => {
            const isFriend = friends.includes(s.id);
            return (
              <View key={s.id} style={styles.row}>
                {/* Avatar */}
                <View style={styles.avatar}>
                  <Text style={{ fontSize: 22 }}>👤</Text>
                </View>

                {/* Info */}
                <View style={styles.info}>
                  <Text style={styles.name}>{s.name}</Text>
                  <Text style={styles.sub}>
                    @{s.gameUsername} · مستوى {s.level}
                  </Text>
                </View>

                {/* Action */}
                <TouchableOpacity
                  style={[styles.addBtn, isFriend && styles.addBtnSent]}
                  onPress={() => !isFriend && sendRequest(s.id)}
                  activeOpacity={0.85}
                  disabled={isFriend}
                >
                  <Feather
                    name={isFriend ? "check" : "user-plus"}
                    size={15}
                    color={isFriend ? "#FFF" : "#0F0A2E"}
                  />
                  <Text style={[styles.addBtnText, isFriend && { color: "#FFF" }]}>
                    {isFriend ? "صديق" : "إضافة"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

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
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF",
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16, borderWidth: 1,
    borderColor: ACCENT + "40",
    height: 50,
  },
  searchInput: {
    flex: 1, fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFF", paddingHorizontal: 12,
    textAlign: "right",
  },
  sectionLabel: {
    fontSize: 13, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.45)",
    marginHorizontal: 20, marginBottom: 10,
  },
  list: { paddingHorizontal: 16, gap: 10 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  info: { flex: 1 },
  name: {
    fontSize: 14, fontFamily: "Inter_600SemiBold",
    color: "#FFF", marginBottom: 3,
  },
  sub: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: ACCENT,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnSent: { backgroundColor: "#4CAF50" },
  addBtnText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: "#0F0A2E",
  },
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    fontSize: 15, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
  },
});
