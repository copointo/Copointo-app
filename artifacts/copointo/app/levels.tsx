import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RANKS } from "../data/mockData";
import { RANK_LOGOS } from "../data/rankLogos";
import { useApp } from "../context/AppContext";

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

function RankRow({ rank, index, isCurrent }: { rank: typeof RANKS[number]; index: number; isCurrent: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(20)).current;
  const tier = index + 1;
  const logo = RANK_LOGOS[tier];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 380, delay: index * 70, useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0, duration: 420, delay: index * 70,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateX]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <View style={[styles.row, isCurrent && styles.rowCurrent]}>
        <View style={[styles.badgeWrap, { borderColor: rank.color, shadowColor: rank.color }]}>
          {logo ? (
            <Image source={logo} style={styles.badgeImg} />
          ) : (
            <Text style={styles.badgeIcon}>{rank.icon}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.tierLabel}>المستوى {tier}</Text>
            {isCurrent && (
              <View style={styles.currentChip}>
                <Feather name="check" size={10} color="#000" />
                <Text style={styles.currentChipText}>أنت الآن</Text>
              </View>
            )}
          </View>
          <Text style={styles.rankName}>{rank.name}</Text>
          <Text style={styles.rankRange}>المستويات {rank.min} – {rank.max}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function LevelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user, activeGameCafeId } = useApp();

  const cafeProgress = user?.cafeProgress ?? {};
  const cafeIds = Object.keys(cafeProgress);
  const effectiveCafeId =
    (activeGameCafeId && cafeProgress[activeGameCafeId]) ? activeGameCafeId
    : (cafeIds[0] ?? null);
  const currentLevel = effectiveCafeId ? (cafeProgress[effectiveCafeId]?.level ?? 0) : 0;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/(tabs)/game")}
        >
          <Feather name="arrow-right" size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المستويات</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          تقدّم في الكوفي واربح شعار جديد مع كل مستوى — كل ما ارتفعت زادت قيمتك في عالم Copointo
        </Text>

        {RANKS.map((r, i) => (
          <RankRow
            key={i}
            rank={r}
            index={i}
            isCurrent={currentLevel >= r.min && currentLevel <= r.max}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
    transform: [{ scaleX: -1 }],
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },

  scroll: { padding: 18, paddingBottom: 60, gap: 12 },
  intro: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)", textAlign: "center",
    marginBottom: 8, lineHeight: 20,
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#0A0606",
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  rowCurrent: {
    borderColor: PRIMARY, borderWidth: 2,
    backgroundColor: "rgba(232,184,109,0.10)",
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  badgeWrap: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  badgeImg: { width: 50, height: 50, resizeMode: "contain" },
  badgeIcon: { fontSize: 30 },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  tierLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  currentChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: PRIMARY,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  currentChipText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#000" },
  rankName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 2 },
  rankRange: { fontSize: 11, fontFamily: "Inter_500Medium", color: PRIMARY },
});
