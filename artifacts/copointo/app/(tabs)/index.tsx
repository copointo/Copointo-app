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
  // Anything within ~30 m is effectively "you're here" — show 0 m so the
  // user doesn't see misleading 12 m / 28 m jitter from GPS noise when
  // standing inside the cafe.
  if (km * 1000 < 30) return `0 ${mLabel}`;
  // Sub-kilometre → exact metres (e.g. "742 م"). Above 1 km we show two
  // decimal places so distances like 1.24 km don't get rounded down to 1.2.
  if (km < 1) return `${Math.round(km * 1000)} ${mLabel}`;
  return `${km.toFixed(2)} ${kmLabel}`;
}

/** Fetch real driving distance (in km) from the public OSRM server.
 *  Falls back to `null` on any failure — caller should use haversine as a
 *  fallback display so the user always sees something. */
async function fetchRoadKm(
  uLat: number, uLng: number, cLat: number, cLng: number,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${uLng},${uLat};${cLng},${cLat}?overview=false&alternatives=false&steps=false`;
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    const j: any = await r.json();
    const meters = j?.routes?.[0]?.distance;
    if (typeof meters !== "number" || meters <= 0) return null;
    return meters / 1000;
  } catch {
    return null;
  }
}

function mapCafe(c: ApiCafe, kmLabel: string, mLabel: string, userLat?: number, userLng?: number, roadKm?: number | null): Cafe {
  let distance = "";
  if (userLat != null && userLng != null && c.lat != null && c.lng != null) {
    const straightKm = haversineKm(userLat, userLng, c.lat, c.lng);
    // Prefer the OSRM road distance ONLY when:
    //   1) the straight-line distance is meaningful (≥ 250 m), AND
    //   2) the road distance isn't wildly inflated vs. straight-line.
    //      OSRM snaps to the nearest drivable road graph node, so when the
    //      user is standing in/near the cafe (off-road, in a parking lot,
    //      or on a side-street the OSRM graph doesn't know) it can return
    //      ~1–2 km for a roundtrip via the nearest mapped road. In that
    //      case the haversine is the truthful answer.
    const useRoad =
      roadKm != null &&
      roadKm > 0 &&
      straightKm >= 0.25 &&
      roadKm <= straightKm * 3 + 0.3;
    const km = useRoad ? roadKm! : straightKm;
    distance = formatDist(km, kmLabel, mLabel);
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
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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
        // Use High accuracy so cafe-distance is precise; Balanced can snap
        // to a cell-tower fix that's hundreds of metres off and makes a
        // cafe you're standing in look 1–2 km away.
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch { /* permission denied or unavailable */ }
    })();
  }, []);

  // Cache of cafeId → road-distance (km), keyed alongside the user location
  // it was computed for so we recompute when the user moves.
  const [roadKmByCafe, setRoadKmByCafe] = useState<Record<string, number>>({});

  // Re-map cafes whenever raw data, user location, road-distance cache, or
  // language changes. Distance prefers the road distance from OSRM and falls
  // back to the straight-line haversine while OSRM is still loading.
  useEffect(() => {
    const kmLabel = t("common.km");
    const mLabel = t("common.m");
    setApiCafes(rawCafes.map(c =>
      mapCafe(c, kmLabel, mLabel, userLoc?.lat, userLoc?.lng, roadKmByCafe[c.id]),
    ));
  }, [rawCafes, userLoc, roadKmByCafe, t]);

  // Whenever we have a user location and a list of cafes with coordinates,
  // fetch real driving distances from the OSRM public server in parallel.
  // Each result updates the per-cafe cache as soon as it lands, so cards
  // refresh progressively from straight-line → real road distance.
  useEffect(() => {
    if (!userLoc || rawCafes.length === 0) return;
    const ac = new AbortController();
    const targets = rawCafes.filter(c => c.lat != null && c.lng != null);
    setRoadKmByCafe({}); // reset on user-location change so stale values don't leak
    targets.forEach(c => {
      fetchRoadKm(userLoc.lat, userLoc.lng, c.lat as number, c.lng as number, ac.signal)
        .then(km => {
          if (km == null || ac.signal.aborted) return;
          setRoadKmByCafe(prev => ({ ...prev, [c.id]: km }));
        })
        .catch(() => { /* ignore — falls back to haversine */ });
    });
    return () => ac.abort();
  }, [userLoc, rawCafes]);

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
