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
      grad:    ["#A0673A", "#6B3A1F", "#3D1E0A"] as const,
      deep:    "#1A0A03",
      onPress: () => go(`/cafe/${id}/order`),
    },
    {
      icon:    "✨",
      label:   "شات Copointo",
      sub:     "احصل على توصية ذكية تناسبك",
      grad:    ["#A0673A", "#6B3A1F", "#3D1E0A"] as const,
      deep:    "#1A0A03",
      onPress: () => go(`/cafe/${id}/chat`),
    },
    {
      icon:    "🪑",
      label:   "احجز طاولة",
      sub:     "احجز مقعدك واستمتع بتجربتك",
      grad:    ["#A0673A", "#6B3A1F", "#3D1E0A"] as const,
      deep:    "#1A0A03",
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

        {/* Top row: 2 square cards */}
        <View style={styles.actionsTopRow}>
          {ACTIONS.slice(0, 2).map((a) => (
            <TouchableOpacity
              key={a.label}
              onPress={a.onPress}
              activeOpacity={0.82}
              style={styles.actionSquareWrap}
            >
              {/* 3D depth layer */}
              <View style={[styles.actionDepth, { backgroundColor: a.deep }]} />
              {/* Main card */}
              <LinearGradient
                colors={a.grad}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.actionSquare}
              >
                {/* Top shine */}
                <LinearGradient
                  colors={["rgba(255,255,255,0.30)", "rgba(255,255,255,0.00)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.actionShine}
                />
                <Text style={styles.actionSquareIcon}>{a.icon}</Text>
                <Text style={styles.actionSquareLabel}>{a.label}</Text>
                <Text style={styles.actionSquareSub} numberOfLines={2}>{a.sub}</Text>
                <View style={styles.actionSquareArrow}>
                  <Feather name="arrow-up-right" size={13} color="rgba(255,255,255,0.9)" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom: full-width card */}
        {ACTIONS[2] && (
          <TouchableOpacity
            onPress={ACTIONS[2].onPress}
            activeOpacity={0.82}
            style={styles.actionWideWrap}
          >
            {/* 3D depth layer */}
            <View style={[styles.actionWideDepth, { backgroundColor: ACTIONS[2].deep }]} />
            <LinearGradient
              colors={ACTIONS[2].grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.actionWide}
            >
              {/* Top shine */}
              <LinearGradient
                colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0.00)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.actionWideLeft}>
                <Text style={styles.actionWideIcon}>{ACTIONS[2].icon}</Text>
                <View>
                  <Text style={styles.actionWideLabel}>{ACTIONS[2].label}</Text>
                  <Text style={styles.actionWideSub}>{ACTIONS[2].sub}</Text>
                </View>
              </View>
              <View style={styles.actionWideArrow}>
                <Feather name="arrow-up-right" size={18} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}
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

  // Actions — grid layout
  actionsTopRow: { flexDirection: "row", gap: 12 },

  // Square cards — 3D stack
  actionSquareWrap: { flex: 1, borderRadius: 22 },

  // Dark depth slab (the "bottom face" of the 3D button)
  actionDepth: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 22,
    transform: [{ translateY: 5 }],
  },

  actionSquare: {
    padding: 18, aspectRatio: 1,
    justifyContent: "flex-end",
    borderRadius: 22,
    overflow: "hidden",
    // top-highlight border
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.45)",
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },

  // White shimmer overlay (top half of card)
  actionShine: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 80,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  actionSquareIcon:  { fontSize: 34, marginBottom: 8 },
  actionSquareLabel: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  actionSquareSub: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.72)", lineHeight: 15,
  },
  actionSquareArrow: {
    position: "absolute", top: 12, right: 12,
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center", justifyContent: "center",
  },

  // Wide card (احجز طاولة)
  actionWideWrap: { borderRadius: 22, marginTop: 14 },

  actionWideDepth: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 22,
    transform: [{ translateY: 5 }],
  },

  actionWide: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 22, paddingHorizontal: 24,
    borderRadius: 22, overflow: "hidden",
    borderTopWidth: 1.5, borderLeftWidth: 1,
    borderRightWidth: 1, borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.40)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  actionWideLeft:  { flexDirection: "row", alignItems: "center", gap: 16 },
  actionWideIcon:  { fontSize: 32 },
  actionWideLabel: {
    fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  actionWideSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.70)" },
  actionWideArrow: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.20)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center", justifyContent: "center",
  },
});
