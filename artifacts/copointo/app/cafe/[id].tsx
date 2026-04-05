import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/constants/api";

interface ApiCafe {
  id: string; name: string; logo: string; image: string;
  openTime: string; closeTime: string; rating: number; tags: string[]; address: string;
}
function isOpen(o: string, c: string) {
  const now = new Date(); const m = now.getHours()*60+now.getMinutes();
  const p = (t:string)=>{const[h,mm]=t.split(":").map(Number);return h*60+(mm||0);};
  const op=p(o),cl=p(c); return cl<=op?(m>=op||m<cl):(m>=op&&m<cl);
}

const BG      = "#0F0A2E";
const CARD    = "rgba(255,255,255,0.07)";
const BORDER  = "rgba(255,255,255,0.10)";
const PRIMARY = "#C67C4E";

export default function CafeLandingScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const [cafe, setCafe] = useState<ApiCafe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ cafes: ApiCafe[] }>("/cafes")
      .then(d => { const found = d.cafes.find(c => c.id === id); if (found) setCafe(found); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: BG, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }
  if (!cafe) {
    return (
      <View style={[styles.container, { backgroundColor: BG, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "#fff", fontSize: 16 }}>الكوفي غير موجود</Text>
      </View>
    );
  }

  const cafeOpen     = isOpen(cafe.openTime, cafe.closeTime);
  const cafeCategory = cafe.tags?.[0] ?? "Coffee";
  const cafeImage    = cafe.image ? { uri: cafe.image } : require("@/assets/images/icon.png");
  const isLogoUrl    = !!(cafe.logo && (cafe.logo.startsWith("http") || cafe.logo.startsWith("data:") || cafe.logo.startsWith("blob:")));

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
        <Image source={cafeImage} style={styles.heroImg} resizeMode="cover" />
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
            {isLogoUrl
              ? <Image source={{ uri: cafe.logo }} style={{ width: 50, height: 50, borderRadius: 25 }} />
              : <Text style={{ fontSize: 30 }}>{cafe.logo || "☕"}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{cafe.name}</Text>
            <Text style={styles.heroCategory}>{cafeCategory}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: cafeOpen ? "#1B5E20" : "#424242" }]}>
            <View style={[styles.statusDot, { backgroundColor: cafeOpen ? "#66BB6A" : "#9E9E9E" }]} />
            <Text style={styles.statusText}>{cafeOpen ? "مفتوح" : "مغلق"}</Text>
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
            <Text style={styles.chipText}>{cafe.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.chip}>
            <Feather name="map-pin" size={13} color="rgba(255,255,255,0.55)" />
            <Text style={styles.chipText}>{cafe.address}</Text>
          </View>
          <View style={styles.chip}>
            <Feather name="clock" size={13} color="rgba(255,255,255,0.55)" />
            <Text style={styles.chipText}>{cafe.openTime} – {cafe.closeTime}</Text>
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
              activeOpacity={0.85}
              style={styles.actionWrap}
            >
              <View style={[styles.actionRow, { borderColor: a.grad[0] + "44" }]}>
                {/* Icon circle with gradient */}
                <LinearGradient
                  colors={a.grad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionIconCircle}
                >
                  <Text style={styles.actionIcon}>{a.icon}</Text>
                </LinearGradient>

                {/* Text */}
                <View style={styles.actionText}>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                  <Text style={styles.actionSub} numberOfLines={1}>{a.sub}</Text>
                </View>

                {/* Badge + Arrow */}
                <View style={styles.actionRight}>
                  <View style={[styles.badgeWrap, { backgroundColor: a.grad[0] + "22", borderColor: a.grad[0] + "44" }]}>
                    <Text style={[styles.badgeText, { color: a.grad[0] }]}>{a.badge}</Text>
                  </View>
                  <View style={[styles.arrowCircle, { backgroundColor: a.grad[0] + "22" }]}>
                    <Feather name="chevron-left" size={16} color={a.grad[0]} />
                  </View>
                </View>
              </View>
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
  actions:    { gap: 10 },
  actionWrap: { borderRadius: 18, overflow: "hidden" },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderRadius: 18, paddingVertical: 13, paddingHorizontal: 14,
  },
  actionIconCircle: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  actionIcon:   { fontSize: 22 },
  actionText:   { flex: 1, gap: 3 },
  actionLabel:  { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  actionSub:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },
  actionRight:  { alignItems: "flex-end", gap: 6, flexShrink: 0 },
  badgeWrap: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  arrowCircle: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
});
