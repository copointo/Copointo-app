import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Linking,
  Modal,
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
  id: string; name: string; logo: string; image: string; lat?: number; lng?: number;
  openTime: string; closeTime: string; rating: number; tags: string[]; address: string;
}
function isOpen(o: string, c: string) {
  const now = new Date(); const m = now.getHours()*60+now.getMinutes();
  const p = (t:string)=>{const[h,mm]=t.split(":").map(Number);return h*60+(mm||0);};
  const op=p(o),cl=p(c); return cl<=op?(m>=op||m<cl):(m>=op&&m<cl);
}
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const d = (x: number) => x * Math.PI / 180;
  const dLat = d(lat2 - lat1), dLon = d(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(d(lat1)) * Math.cos(d(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(a));
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

  // User location states
  const [userLoc,        setUserLoc]        = useState<{ lat: number; lng: number } | null>(null);
  const [locPrompt,      setLocPrompt]      = useState(false);   // show custom prompt
  const [locLoading,     setLocLoading]     = useState(false);   // fetching coords

  // Prompt slide-up animation
  const promptAnim = useRef(new Animated.Value(0)).current;
  const showPrompt = () => {
    setLocPrompt(true);
    Animated.spring(promptAnim, { toValue: 1, useNativeDriver: false, tension: 60, friction: 10 }).start();
  };
  const hidePrompt = () => {
    Animated.timing(promptAnim, { toValue: 0, duration: 220, useNativeDriver: false, easing: Easing.out(Easing.ease) }).start(() => setLocPrompt(false));
  };
  const promptTranslate = promptAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

  const requestLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { hidePrompt(); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch { /* unavailable */ }
    finally { setLocLoading(false); hidePrompt(); }
  };

  // On mount: check permission status, show prompt if undetermined
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        // Already granted — silently get location
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch { /* ignore */ }
      } else if (status === "undetermined") {
        // Show our custom prompt after a short delay
        setTimeout(showPrompt, 600);
      }
      // If denied: nothing shown
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      label:   "اطلب قهوة",
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
      label:   `شات ${cafe.name}`,
      sub:     "احصل على توصية ذكية تناسبك",
      bg:      "",
      solidColors: ["#7C3AED", "#5B21B6", "#3B0764"] as const,
      deep:    "#1A0845",
      onPress: () => go(`/cafe/${id}/chat`),
    },
  ];

  return (
    <View style={styles.container}>

      {/* ── Location Permission Prompt ── */}
      <Modal transparent visible={locPrompt} animationType="none" statusBarTranslucent>
        <View style={styles.promptBackdrop}>
          <Animated.View style={[styles.promptSheet, { transform: [{ translateY: promptTranslate }] }]}>
            {/* Header pill */}
            <View style={styles.promptPill} />
            {/* Icon */}
            <View style={styles.promptIconWrap}>
              <LinearGradient colors={["#C67C4E", "#8B4513"]} style={styles.promptIconBg}>
                <Feather name="navigation" size={28} color="#FFF" />
              </LinearGradient>
            </View>
            <Text style={styles.promptTitle}>اعرف مسافتك عن الكوفي</Text>
            <Text style={styles.promptBody}>
              نحتاج إذنك للوصول إلى موقعك الحالي لحساب المسافة بينك وبين الكوفي
            </Text>
            <TouchableOpacity
              style={styles.promptAllowBtn}
              onPress={requestLocation}
              activeOpacity={0.85}
              disabled={locLoading}
            >
              {locLoading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <>
                    <Feather name="map-pin" size={16} color="#FFF" />
                    <Text style={styles.promptAllowText}>السماح بالموقع</Text>
                  </>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.promptLaterBtn} onPress={hidePrompt} activeOpacity={0.7}>
              <Text style={styles.promptLaterText}>لاحقاً</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

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

        {/* ── Location & Distance ── */}
        {(() => {
          const dist = (userLoc && cafe.lat && cafe.lng)
            ? haversineKm(userLoc.lat, userLoc.lng, cafe.lat, cafe.lng)
            : null;
          const distStr = dist === null ? null
            : dist < 1 ? `${Math.round(dist * 1000)} م` : `${dist.toFixed(1)} كم`;
          const openMaps = () => {
            const q = cafe.lat && cafe.lng
              ? `${cafe.lat},${cafe.lng}`
              : encodeURIComponent(cafe.address);
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
          };
          return (
            <View style={styles.locationCard}>
              {/* Left: address + distance */}
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={14} color={PRIMARY} />
                  <Text style={styles.locationAddress} numberOfLines={2}>{cafe.address}</Text>
                </View>
                {distStr !== null && (
                  <View style={styles.locationRow}>
                    <Feather name="navigation" size={13} color="#66BB6A" />
                    <Text style={styles.distInlineText}>
                      يبعد عنك <Text style={styles.distInlineValue}>{distStr}</Text>
                    </Text>
                  </View>
                )}
              </View>
              {/* Right: map button */}
              <TouchableOpacity style={styles.mapsBtn} onPress={openMaps} activeOpacity={0.8}>
                <Feather name="map" size={15} color="#FFF" />
                <Text style={styles.mapsBtnText}>الخريطة</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

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
  // Location card
  locationCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  locationRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  locationAddress: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.70)", flex: 1 },
  distInlineText:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  distInlineValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#66BB6A" },
  mapsBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  mapsBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Location permission prompt (bottom sheet)
  promptBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  promptSheet: {
    backgroundColor: "#1A1040",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 28, paddingBottom: 36, paddingTop: 14,
    alignItems: "center",
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  promptPill: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)", marginBottom: 24,
  },
  promptIconWrap: { marginBottom: 18 },
  promptIconBg: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  promptTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "center", marginBottom: 10,
  },
  promptBody: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.60)", textAlign: "center",
    lineHeight: 22, marginBottom: 28,
  },
  promptAllowBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: PRIMARY, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 40,
    width: "100%", justifyContent: "center", marginBottom: 12,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  promptAllowText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  promptLaterBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  promptLaterText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)" },
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
