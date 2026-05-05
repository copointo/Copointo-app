import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CafeCard } from "@/components/CafeCard";
import { SearchBar } from "@/components/SearchBar";
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { useResponsive } from "@/hooks/useResponsive";
import { apiFetch } from "@/constants/api";
import type { Cafe } from "@/data/mockData";

// ── API shape from server ─────────────────────────────────────
interface ApiCafe {
  id: string;
  name: string;
  logo: string;
  image: string;
  openTime: string;
  closeTime: string;
  rating: number;
  tags: string[];
  address: string;
  lat?: number;
  lng?: number;
}

function isOpen(openTime: string, closeTime: string): boolean {
  const now   = new Date();
  const mins  = now.getHours() * 60 + now.getMinutes();
  const parse = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  const open  = parse(openTime);
  const close = parse(closeTime);
  return close <= open ? (mins >= open || mins < close) : (mins >= open && mins < close);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number, kmLabel: string, mLabel: string): string {
  if (km < 1) return `${Math.round(km * 1000)} ${mLabel}`;
  return `${km.toFixed(1)} ${kmLabel}`;
}

function mapCafe(c: ApiCafe, kmLabel: string, mLabel: string, userLat?: number, userLng?: number): Cafe {
  let distance = "";
  if (userLat != null && userLng != null && c.lat != null && c.lng != null) {
    distance = formatDist(haversineKm(userLat, userLng, c.lat, c.lng), kmLabel, mLabel);
  }
  return {
    id:          c.id,
    name:        c.name,
    logo:        c.logo || "☕",
    image:       c.image ? { uri: c.image } : require("@/assets/images/icon.png"),
    isOpen:      isOpen(c.openTime, c.closeTime),
    rating:      c.rating ?? 0,
    reviewCount: 0,
    distance,
    category:    c.tags?.[0] ?? "Coffee",
    address:     c.address,
    tags:        c.tags ?? [],
    lat:         c.lat,
    lng:         c.lng,
  };
}

// ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const r       = useResponsive();
  const router  = useRouter();
  const { user } = useApp();
  const { t, lang, toggle } = useT();
  const [search,      setSearch]      = useState("");
  const [rawCafes,    setRawCafes]    = useState<ApiCafe[]>([]);
  const [apiCafes,    setApiCafes]    = useState<Cafe[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [userLoc,     setUserLoc]     = useState<{ lat: number; lng: number } | null>(null);
  const [openingMap,  setOpeningMap]  = useState(false);
  const locRequested = useRef(false);

  // "Cafes on the map" button handler — first asks for location permission
  // (so the map can show the user pin), then routes to /cafes-map.
  // If the user denies permission we still proceed to the map so they can at
  // least see all cafe pins; this matches the existing pattern in cafe/[id].tsx.
  const openMap = useCallback(async () => {
    if (openingMap) return;
    setOpeningMap(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let status = current.status;
      if (status !== "granted" && current.canAskAgain) {
        const r = await Location.requestForegroundPermissionsAsync();
        status = r.status;
      }
      if (status === "granted") {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch { /* ignore — we still open the map */ }
      } else if (current.status === "denied" && !current.canAskAgain) {
        // Inform the user once but don't block them from seeing the cafe pins.
        Alert.alert(t("home.locationOff"), t("home.locationOffMsg"));
      }
    } catch { /* permission API failed — proceed anyway */ }
    finally {
      setOpeningMap(false);
      router.push("/cafes-map" as any);
    }
  }, [openingMap, router, t]);

  // Request location once on mount
  useEffect(() => {
    if (locRequested.current) return;
    locRequested.current = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch { /* permission denied or unavailable */ }
    })();
  }, []);

  // Re-map cafes whenever raw data, user location, or language changes
  useEffect(() => {
    const kmLabel = t("common.km");
    const mLabel = t("common.m");
    setApiCafes(rawCafes.map(c => mapCafe(c, kmLabel, mLabel, userLoc?.lat, userLoc?.lng)));
  }, [rawCafes, userLoc, t]);

  const fetchCafes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ cafes: ApiCafe[] }>("/cafes");
      setRawCafes(data.cafes);
    } catch {
      setError(t("home.errorLoadingCafes"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { fetchCafes(); }, [fetchCafes]);

  const filtered = useMemo(() =>
    apiCafes.filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some(t => t.includes(search))
    ), [apiCafes, search]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center" }]}>
     <View style={{ width: "100%", maxWidth: r.contentMaxWidth, flex: 1 }}>
      <View style={[styles.header, { paddingTop: topPadding + 12, paddingHorizontal: r.hPad }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{t("home.greetingMorning")}</Text>
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {user?.name?.split(" ")[0] ?? t("common.guest")} ☕
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(); }}
          activeOpacity={0.85}
          style={[styles.langBtn, { borderColor: "rgba(232,184,109,0.35)", backgroundColor: colors.card }]}
          accessibilityLabel="Toggle language"
        >
          <Feather name="globe" size={14} color="#E8B86D" />
          <Text style={styles.langBtnText}>
            {lang === "ar" ? t("lang.toggleToEn") : t("lang.toggleToAr")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: r.hPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchCafes(true)} tintColor={colors.foreground} />
        }
      >
        <View style={styles.searchWrapper}>
          <SearchBar value={search} onChangeText={setSearch} placeholder={t("home.searchPlaceholder")} />
        </View>

        {/* ── Cafes on the map ── */}
        <TouchableOpacity
          onPress={openMap}
          activeOpacity={0.85}
          style={[styles.mapBtn, { backgroundColor: colors.card, borderColor: "rgba(232,184,109,0.35)" }]}
        >
          <View style={styles.mapBtnIcon}>
            <Feather name="map" size={18} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.mapBtnTitle, { color: colors.foreground }]}>{t("home.mapBtnTitle")}</Text>
            <Text style={[styles.mapBtnSub, { color: colors.mutedForeground }]}>
              {t("home.mapBtnSub")}
            </Text>
          </View>
          {openingMap
            ? <ActivityIndicator size="small" color={colors.primary ?? "#E8B86D"} />
            : <Feather name={lang === "ar" ? "chevron-left" : "chevron-right"} size={20} color={colors.mutedForeground} />}
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("home.nearbyCafes")}</Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>{t("home.cafeCount", { count: filtered.length })}</Text>
        </View>

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.primary ?? "#C67C4E"} />
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="coffee" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {apiCafes.length === 0 ? t("home.noCafesYet") : t("home.noResults")}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((cafe) => (
              <View key={cafe.id} style={styles.gridItem}>
                <CafeCard cafe={cafe} compact />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: Platform.OS === "web" ? 110 : 100 }} />
      </ScrollView>
     </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 20, paddingBottom: 12 },
  greeting:      { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  userName:      { fontSize: 22, fontFamily: "Inter_700Bold" },
  langBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1,
  },
  langBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#E8B86D", letterSpacing: 0.5 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  searchWrapper: { marginBottom: 12 },
  mapBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 16,
  },
  mapBtnIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "#E8B86D",
    alignItems: "center", justifyContent: "center",
  },
  mapBtnTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  mapBtnSub:   { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle:  { fontSize: 18, fontFamily: "Inter_700Bold" },
  count:         { fontSize: 13, fontFamily: "Inter_400Regular" },
  empty:         { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText:     { fontSize: 16, fontFamily: "Inter_400Regular" },
  grid:          { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "flex-start" },
  gridItem:      { flexBasis: "48%", flexGrow: 1, minWidth: 160, maxWidth: 320 },
});
