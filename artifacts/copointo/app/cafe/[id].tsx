import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
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

  // Shimmer animation — must be before any conditional return
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.delay(1800),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();
  }, [shimmer]);
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-160, 520] });

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
      mciIcon: "coffee-maker" as const,
      label:   "اطلب الان",
      sub:     "تصفح القائمة واطلب مشروبك المفضل",
      bg:      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&h=500&fit=crop&q=90",
      deep:    "#0D0704",
      onPress: () => go(`/cafe/${id}/order`),
    },
    {
      mciIcon: "table-furniture" as const,
      label:   "احجز طاولة",
      sub:     "احجز مقعدك واستمتع بتجربتك",
      bg:      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500&h=500&fit=crop&q=90",
      deep:    "#080503",
      onPress: () => go(`/cafe/${id}/book`),
    },
    {
      mciIcon: "message-text" as const,
      label:   "شات Copointo",
      sub:     "احصل على توصية ذكية تناسبك",
      bg:      "",
      solidColors: ["#7C3AED", "#5B21B6", "#3B0764"] as const,
      deep:    "#1A0845",
      onPress: () => go(`/cafe/${id}/chat`),
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
              {/* Main card with photo background */}
              <ImageBackground
                source={{ uri: a.bg }}
                style={styles.actionSquare}
                imageStyle={styles.actionBgImage}
              >
                {/* Dark overlay for readability */}
                <View style={styles.actionOverlay} />
                {/* Shimmer sweep */}
                <Animated.View
                  pointerEvents="none"
                  style={[styles.shimmerStrip, { transform: [{ translateX: shimmerX }, { rotate: "25deg" }] }]}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                <Text style={styles.actionSquareLabel}>{a.label}</Text>
              </ImageBackground>
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
            {ACTIONS[2].solidColors ? (
              <LinearGradient
                colors={ACTIONS[2].solidColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionWide}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[styles.shimmerStrip, { transform: [{ translateX: shimmerX }, { rotate: "20deg" }] }]}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.20)", "rgba(255,255,255,0)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                <Text style={styles.actionWideLabel}>{ACTIONS[2].label}</Text>
              </LinearGradient>
            ) : (
              <ImageBackground
                source={{ uri: ACTIONS[2].bg }}
                style={styles.actionWide}
                imageStyle={styles.actionBgImage}
              >
                <View style={styles.actionOverlay} />
                <Animated.View
                  pointerEvents="none"
                  style={[styles.shimmerStrip, { transform: [{ translateX: shimmerX }, { rotate: "20deg" }] }]}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.20)", "rgba(255,255,255,0)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                <Text style={styles.actionWideLabel}>{ACTIONS[2].label}</Text>
              </ImageBackground>
            )}
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
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
    overflow: "hidden",
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.45)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },

  // Background photo image style (for ImageBackground imageStyle prop)
  actionBgImage: { borderRadius: 22 },

  // Shimmer sweep strip
  shimmerStrip: {
    position: "absolute", top: -80, bottom: -80,
    width: 55,
    overflow: "visible",
  },

  // Dark overlay — high opacity so photo is subtle background
  actionOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.65)",
  },

  actionSquareLabel: {
    fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // Wide card (احجز طاولة)
  actionWideWrap: { borderRadius: 22, marginTop: 14 },

  actionWideDepth: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 22,
    transform: [{ translateY: 5 }],
  },

  actionWide: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32, paddingHorizontal: 24,
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
  actionWideLabel: {
    fontSize: 26, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
});
