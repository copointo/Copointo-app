import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
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
import { CAFES } from "@/data/mockData";

const BG      = "#0F0A2E";
const CARD    = "rgba(255,255,255,0.07)";
const BORDER  = "rgba(255,255,255,0.10)";
const PRIMARY = "#C67C4E";

export default function CafeLandingScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;

  const cafe = CAFES.find((c) => c.id === id) ?? CAFES[0];

  const go = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(path as any);
  };

  const ACTIONS = [
    {
      icon:    "☕",
      label:   "اطلب الان",
      sub:     "تصفح القائمة واطلب مشروبك المفضل",
      grad:    ["#C67C4E", "#A0522D"] as const,
      badge:   "الأكثر طلباً",
      onPress: () => go(`/cafe/${id}/order`),
    },
    {
      icon:    "✨",
      label:   "شات Copointo",
      sub:     "احصل على توصية ذكية تناسبك",
      grad:    ["#6C3FC5", "#3B1FA0"] as const,
      badge:   "AI مدعوم بـ",
      onPress: () => go(`/cafe/${id}/chat`),
    },
    {
      icon:    "🪑",
      label:   "احجز طاولة",
      sub:     "احجز مقعدك واستمتع بتجربتك",
      grad:    ["#1A6B4A", "#0D4A31"] as const,
      badge:   "متاح الآن",
      onPress: () => go(`/cafe/${id}/book`),
    },
  ];

  return (
    <View style={styles.container}>
      {/* ── Hero Image ── */}
      <View style={styles.heroWrap}>
        <Image source={cafe.image} style={styles.heroImg} resizeMode="cover" />
        <LinearGradient
          colors={["transparent", "rgba(15,10,46,0.85)", BG]}
          style={styles.gradient}
        />

        {/* Back button */}
        <TouchableOpacity
          style={[styles.backBtn, { top: topPad + 8 }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Feather name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>

        {/* Cafe identity on image */}
        <View style={styles.heroInfo}>
          <View style={styles.logoCircle}>
            <Text style={{ fontSize: 30 }}>{cafe.logo}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{cafe.name}</Text>
            <Text style={styles.heroCategory}>{cafe.category}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: cafe.isOpen ? "#1B5E20" : "#424242" }]}>
            <View style={[styles.statusDot, { backgroundColor: cafe.isOpen ? "#66BB6A" : "#9E9E9E" }]} />
            <Text style={styles.statusText}>{cafe.isOpen ? "مفتوح" : "مغلق"}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* ── Meta chips ── */}
        <View style={styles.metaRow}>
          <View style={styles.chip}>
            <Feather name="star" size={13} color="#F9C74F" />
            <Text style={styles.chipText}>{cafe.rating}  ({cafe.reviewCount} تقييم)</Text>
          </View>
          <View style={styles.chip}>
            <Feather name="map-pin" size={13} color="rgba(255,255,255,0.55)" />
            <Text style={styles.chipText}>{cafe.distance}</Text>
          </View>
          <View style={styles.chip}>
            <Feather name="clock" size={13} color="rgba(255,255,255,0.55)" />
            <Text style={styles.chipText}>{cafe.isOpen ? "7ص – 11م" : "يفتح 7ص"}</Text>
          </View>
        </View>

        {/* ── Address ── */}
        <View style={styles.addressRow}>
          <Feather name="navigation" size={14} color={PRIMARY} />
          <Text style={styles.addressText}>{cafe.address}</Text>
        </View>

        {/* ── Tags ── */}
        <View style={styles.tagsRow}>
          {cafe.tags.map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Action buttons ── */}
        <Text style={styles.sectionLabel}>ماذا تريد؟</Text>
        <View style={styles.actions}>
          {ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              onPress={a.onPress}
              activeOpacity={0.88}
              style={styles.actionWrap}
            >
              <LinearGradient
                colors={a.grad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGrad}
              >
                {/* Badge top-right */}
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{a.badge}</Text>
                </View>

                {/* Big icon */}
                <Text style={styles.actionBigIcon}>{a.icon}</Text>

                {/* Text bottom */}
                <View style={styles.actionBottom}>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                  <Text style={styles.actionSub}>{a.sub}</Text>
                </View>

                {/* Arrow */}
                <View style={styles.arrowCircle}>
                  <Feather name="arrow-right" size={16} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Hero
  heroWrap: { height: 300, position: "relative" },
  heroImg:  { width: "100%", height: "100%", resizeMode: "cover" },
  gradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 180 },
  backBtn:  {
    position: "absolute", left: 16,
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  heroInfo: {
    position: "absolute", bottom: 16, left: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  logoCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.25)",
  },
  heroName:     { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 2 },
  heroCategory: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Content
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.80)" },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addressText:{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", flex: 1 },
  tagsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: `${PRIMARY}22`, borderRadius: 20,
    borderWidth: 1, borderColor: `${PRIMARY}44`,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  tagText: { fontSize: 12, fontFamily: "Inter_500Medium", color: PRIMARY },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.40)", marginBottom: 4 },

  // Actions
  actions:     { gap: 14 },
  actionWrap:  { borderRadius: 24, overflow: "hidden" },
  actionGrad:  {
    padding: 20, minHeight: 120,
    justifyContent: "space-between",
  },
  badgeWrap: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.20)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 8,
  },
  badgeText:    { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  actionBigIcon:{ fontSize: 38, marginBottom: 8 },
  actionBottom: { gap: 3 },
  actionLabel:  { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  actionSub:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.70)" },
  arrowCircle:  {
    position: "absolute", bottom: 16, right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center", justifyContent: "center",
  },
});
