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

const BG     = "#0F0A2E";
const ACCENT = "#E8B86D";

type FriendRequest = {
  kind: "friend_request";
  id: string;
  name: string;
  username: string;
  level: number;
  time: string;
  status: "pending" | "accepted" | "rejected";
};

type FreeCoffee = {
  kind: "free_coffee";
  id: string;
  level: number;
  code: string;
  time: string;
  used: boolean;
};

type Notification = FriendRequest | FreeCoffee;

const INITIAL: Notification[] = [
  {
    kind: "friend_request",
    id: "fr1",
    name: "Mohammed Al-Habsi",
    username: "mohammed_h",
    level: 45,
    time: "منذ دقيقتين",
    status: "pending",
  },
  {
    kind: "free_coffee",
    id: "fc1",
    level: 7,
    code: "COFFEE-X7K2M",
    time: "منذ 10 دقائق",
    used: false,
  },
  {
    kind: "friend_request",
    id: "fr2",
    name: "Sara Al-Zahra",
    username: "sara_z",
    level: 31,
    time: "منذ ساعة",
    status: "pending",
  },
  {
    kind: "free_coffee",
    id: "fc2",
    level: 14,
    code: "COFFEE-A3NQP",
    time: "منذ يومين",
    used: true,
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [notifs, setNotifs] = useState<Notification[]>(INITIAL);

  const respondFriend = (id: string, action: "accepted" | "rejected") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotifs((prev) =>
      prev.map((n) =>
        n.id === id && n.kind === "friend_request"
          ? { ...n, status: action }
          : n
      )
    );
  };

  const markCoffeeUsed = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifs((prev) =>
      prev.map((n) =>
        n.id === id && n.kind === "free_coffee" ? { ...n, used: true } : n
      )
    );
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
        <Text style={styles.headerTitle}>الإشعارات</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {notifs.map((n) => {
          if (n.kind === "friend_request") {
            return (
              <View key={n.id} style={styles.card}>
                {/* Avatar + info */}
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={{ fontSize: 22 }}>👤</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{n.name}</Text>
                    <Text style={styles.cardSub}>
                      @{n.username} · مستوى {n.level}
                    </Text>
                    <Text style={styles.cardTime}>{n.time}</Text>
                  </View>
                </View>

                {/* Actions */}
                {n.status === "pending" ? (
                  <View style={styles.friendActions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => respondFriend(n.id, "accepted")}
                      activeOpacity={0.85}
                    >
                      <Feather name="check" size={15} color="#FFF" />
                      <Text style={styles.acceptBtnText}>قبول</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => respondFriend(n.id, "rejected")}
                      activeOpacity={0.85}
                    >
                      <Feather name="x" size={15} color="#FFF" />
                      <Text style={styles.rejectBtnText}>رفض</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[
                    styles.statusTag,
                    { backgroundColor: n.status === "accepted" ? "#4CAF5020" : "#EF535020" },
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: n.status === "accepted" ? "#4CAF50" : "#EF5350" },
                    ]}>
                      {n.status === "accepted" ? "✓ تم القبول" : "✕ تم الرفض"}
                    </Text>
                  </View>
                )}
              </View>
            );
          }

          if (n.kind === "free_coffee") {
            return (
              <View key={n.id} style={[styles.card, styles.coffeeCard]}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, { backgroundColor: "rgba(232,184,109,0.15)" }]}>
                    <Text style={{ fontSize: 26 }}>☕</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, { color: ACCENT }]}>مشروب مجاني! 🎉</Text>
                    <Text style={styles.cardSub}>وصلت إلى المستوى {n.level}</Text>
                    <Text style={styles.cardTime}>{n.time}</Text>
                  </View>
                </View>

                {/* Code box */}
                <View style={[styles.codeBox, n.used && styles.codeBoxUsed]}>
                  <Text style={styles.codeLabel}>
                    {n.used ? "الكود مستخدم" : "كود الاستخدام (مرة واحدة)"}
                  </Text>
                  <Text style={[styles.code, n.used && styles.codeUsed]}>
                    {n.code}
                  </Text>
                  {!n.used && (
                    <TouchableOpacity
                      style={styles.useBtn}
                      onPress={() => markCoffeeUsed(n.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.useBtnText}>تم الاستخدام</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }

          return null;
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
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF",
  },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    gap: 14,
  },
  coffeeCard: {
    borderColor: ACCENT + "40",
    backgroundColor: "rgba(232,184,109,0.06)",
  },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF",
  },
  cardSub: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  cardTime: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.28)", marginTop: 2,
  },
  friendActions: { flexDirection: "row", gap: 10 },
  acceptBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    backgroundColor: "#4CAF50",
    paddingVertical: 10, borderRadius: 12,
  },
  acceptBtnText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF",
  },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    backgroundColor: "rgba(239,83,80,0.25)",
    borderWidth: 1, borderColor: "#EF5350",
    paddingVertical: 10, borderRadius: 12,
  },
  rejectBtnText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#EF5350",
  },
  statusTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 13, fontFamily: "Inter_600SemiBold",
  },
  codeBox: {
    backgroundColor: "rgba(232,184,109,0.10)",
    borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: ACCENT + "50",
    alignItems: "center", gap: 8,
    borderStyle: "dashed",
  },
  codeBoxUsed: {
    opacity: 0.45,
    borderStyle: "solid",
  },
  codeLabel: {
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: "rgba(232,184,109,0.7)",
  },
  code: {
    fontSize: 22, fontFamily: "Inter_700Bold",
    color: ACCENT, letterSpacing: 2,
  },
  codeUsed: {
    textDecorationLine: "line-through",
    color: "rgba(232,184,109,0.4)",
  },
  useBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 10, marginTop: 4,
  },
  useBtnText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: "#0F0A2E",
  },
});
