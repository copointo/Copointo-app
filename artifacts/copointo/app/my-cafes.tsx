import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { getRank } from "@/data/mockData";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";
const CREAM   = "#F5E6CC";

export default function MyCafesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, activeGameCafeId, setActiveGameCafeId } = useApp();
  const { t } = useT();

  const cafes = Object.values(user?.cafeProgress ?? {})
    .sort((a, b) => b.level - a.level);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSelect = (cafeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveGameCafeId(cafeId);
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.85}>
          <Feather name="arrow-right" size={18} color={CREAM} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("myCafes.title")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.subtitle}>
        {t("myCafes.subtitle")}
      </Text>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {cafes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="coffee" size={42} color={PRIMARY} />
            <Text style={styles.emptyTitle}>{t("myCafes.emptyTitle")}</Text>
            <Text style={styles.emptyHint}>
              {t("myCafes.emptyHint")}
            </Text>
          </View>
        ) : (
          cafes.map((c) => {
            const isActive = c.cafeId === activeGameCafeId;
            const rank = getRank(c.level);
            return (
              <TouchableOpacity
                key={c.cafeId}
                style={[styles.card, isActive && styles.cardActive]}
                onPress={() => handleSelect(c.cafeId)}
                activeOpacity={0.85}
                disabled={isActive}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <Feather name="coffee" size={20} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cafeName} numberOfLines={1}>{c.cafeName}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.rankIcon}>{rank.icon}</Text>
                      <Text style={styles.rankName}>{rank.name}</Text>
                      <View style={styles.dot} />
                      <Text style={styles.metaText}>
                        {t("myCafes.orderCount", { count: c.totalOrders })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.levelBox}>
                    <Text style={styles.levelNum}>{c.level}</Text>
                    <Text style={styles.levelLabel}>{t("myCafes.level")}</Text>
                  </View>
                </View>

                {isActive ? (
                  <View style={styles.activeBadge}>
                    <Feather name="check" size={14} color={PRIMARY} />
                    <Text style={styles.activeBadgeText}>{t("myCafes.activeBadge")}</Text>
                  </View>
                ) : (
                  <View style={styles.tapHint}>
                    <Feather name="eye" size={13} color={PRIMARY} />
                    <Text style={styles.tapHintText}>{t("myCafes.tapHint")}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: insets.bottom + 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: CREAM },
  subtitle: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    color: "rgba(245,230,204,0.6)",
    paddingHorizontal: 20, paddingBottom: 12, textAlign: "right",
    lineHeight: 20,
  },
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  emptyBox: {
    alignItems: "center", padding: 40, gap: 12,
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER, marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: CREAM, textAlign: "center" },
  emptyHint:  { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.6)", textAlign: "center", lineHeight: 20 },

  card: {
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, gap: 12,
  },
  cardActive: {
    borderColor: PRIMARY,
    shadowColor: PRIMARY, shadowOpacity: 0.4, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  cafeName: { fontSize: 15, fontFamily: "Inter_700Bold", color: CREAM, textAlign: "right" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  rankIcon: { fontSize: 13 },
  rankName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(245,230,204,0.4)" },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.65)" },

  levelBox: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1, borderColor: PRIMARY,
    backgroundColor: "rgba(232,184,109,0.10)", minWidth: 56,
  },
  levelNum:   { fontSize: 18, fontFamily: "Inter_700Bold", color: PRIMARY, lineHeight: 22 },
  levelLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "rgba(232,184,109,0.7)" },

  activeBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: PRIMARY,
  },
  activeBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  tapHint: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 8,
  },
  tapHintText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(232,184,109,0.85)" },
});
