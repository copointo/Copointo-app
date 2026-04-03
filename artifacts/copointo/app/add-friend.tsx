import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

const SUGGESTIONS = [
  { id: "s1", name: "Khalid Al-Rashidi",   username: "khalid_r",   level: 58,  mutual: 3 },
  { id: "s2", name: "Sara Al-Zahra",       username: "sara_z",     level: 34,  mutual: 5 },
  { id: "s3", name: "Omar Bin Salim",      username: "omar_s",     level: 121, mutual: 1 },
  { id: "s4", name: "Fatima Al-Balushi",   username: "fatima_b",   level: 77,  mutual: 2 },
  { id: "s5", name: "Yusuf Al-Maawali",   username: "yusuf_m",    level: 203, mutual: 4 },
];

const BG = "#0F0A2E";
const ACCENT = "#E8B86D";

export default function AddFriendScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 67 : insets.top;

  const [query,   setQuery]   = useState("");
  const [sent,    setSent]    = useState<string[]>([]);

  const filtered = query.trim()
    ? SUGGESTIONS.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.username.toLowerCase().includes(query.toLowerCase())
      )
    : SUGGESTIONS;

  const sendRequest = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSent((prev) => [...prev, id]);
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
          placeholder="ابحث باسم المستخدم..."
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
        {query.trim() ? "نتائج البحث" : "اقتراحات"}
      </Text>

      {/* Results */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>لا توجد نتائج</Text>
          </View>
        ) : (
          filtered.map((s) => {
            const isSent = sent.includes(s.id);
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
                    @{s.username} · مستوى {s.level}
                    {s.mutual > 0 && `  ·  ${s.mutual} مشترك`}
                  </Text>
                </View>

                {/* Action */}
                <TouchableOpacity
                  style={[styles.addBtn, isSent && styles.addBtnSent]}
                  onPress={() => !isSent && sendRequest(s.id, s.name)}
                  activeOpacity={0.85}
                >
                  <Feather
                    name={isSent ? "check" : "user-plus"}
                    size={15}
                    color={isSent ? "#FFF" : "#0F0A2E"}
                  />
                  <Text style={[styles.addBtnText, isSent && { color: "#FFF" }]}>
                    {isSent ? "تم الإرسال" : "إضافة"}
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
  },
});
