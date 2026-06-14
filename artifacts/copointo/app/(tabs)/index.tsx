import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchBar } from "@/components/SearchBar";
import { MiniCafesMap } from "@/components/MiniCafesMap";
import AvatarWithFrame from "@/components/AvatarWithFrame";
import { getDefaultAvatarSource } from "@/lib/defaultAvatar";
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { useFavorites } from "@/hooks/useFavorites";
import { useResponsive } from "@/hooks/useResponsive";
import { apiFetch } from "@/constants/api";
import { getRank, type Cafe } from "@/data/mockData";

const DRINKS_PER_FREE_COFFEE = 6;

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
  if (km * 1000 < 30) return `0 ${mLabel}`;
  if (km < 1) return `${Math.round(km * 1000)} ${mLabel}`;
  return `${km.toFixed(2)} ${kmLabel}`;
}

/** Fetch real driving distance (km) from the public OSRM server; null on failure. */
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

/** Best-known distance (km) between the user and a cafe — prefers OSRM road
 *  distance when sane, falls back to straight-line haversine. Mirrors mapCafe. */
function bestKm(c: ApiCafe, userLat?: number, userLng?: number, roadKm?: number | null): number | null {
  if (userLat == null || userLng == null || c.lat == null || c.lng == null) return null;
  const straightKm = haversineKm(userLat, userLng, c.lat, c.lng);
  const useRoad =
    roadKm != null && roadKm > 0 && straightKm >= 0.25 && roadKm <= straightKm * 3 + 0.3;
  return useRoad ? roadKm! : straightKm;
}

function mapCafe(c: ApiCafe, kmLabel: string, mLabel: string, userLat?: number, userLng?: number, roadKm?: number | null): Cafe {
  const km = bestKm(c, userLat, userLng, roadKm);
  const distance = km != null ? formatDist(km, kmLabel, mLabel) : "";
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
  const { isFavorite, toggle: toggleFav } = useFavorites();

  const [search,      setSearch]      = useState("");
  const [showAllUsed, setShowAllUsed] = useState(false);
  const [rawCafes,    setRawCafes]    = useState<ApiCafe[]>([]);
  const [apiCafes,    setApiCafes]    = useState<Cafe[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [userLoc,     setUserLoc]     = useState<{ lat: number; lng: number } | null>(null);
  const [openingMap,  setOpeningMap]  = useState(false);
  const locRequested = useRef(false);

  // ── Profile header figures ──
  const level   = user?.level ?? 0;
  const rank    = getRank(level);

  const openMap = useCallback(async () => {
    if (openingMap) return;
    setOpeningMap(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let status = current.status;
      if (status !== "granted" && current.canAskAgain) {
        const res = await Location.requestForegroundPermissionsAsync();
        status = res.status;
      }
      if (status === "granted") {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch { /* ignore — we still open the map */ }
      } else if (current.status === "denied" && !current.canAskAgain) {
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
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch { /* permission denied or unavailable */ }
    })();
  }, []);

  const [roadKmByCafe, setRoadKmByCafe] = useState<Record<string, number>>({});

  useEffect(() => {
    const kmLabel = t("common.km");
    const mLabel = t("common.m");
    setApiCafes(rawCafes.map(c =>
      mapCafe(c, kmLabel, mLabel, userLoc?.lat, userLoc?.lng, roadKmByCafe[c.id]),
    ));
  }, [rawCafes, userLoc, roadKmByCafe, t]);

  useEffect(() => {
    if (!userLoc || rawCafes.length === 0) return;
    const ac = new AbortController();
    const targets = rawCafes.filter(c => c.lat != null && c.lng != null);
    setRoadKmByCafe({});
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
      const data = await apiFetch<{ cafes: ApiCafe[] }>(
        user ? `/cafes?userId=${encodeURIComponent(user.id)}` : "/cafes"
      );
      setRawCafes(data.cafes);
    } catch {
      setError(t("home.errorLoadingCafes"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, user]);

  useEffect(() => { fetchCafes(); }, [fetchCafes]);

  // Search filter applied to every list on the screen.
  const filtered = useMemo(() =>
    apiCafes.filter(c =>
      (!search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some(tag => tag.includes(search)))
    ), [apiCafes, search]);

  // Nearby cafes — those with coordinates, sorted by best-known distance.
  // Respects the same search + "open only" filter as the rest of the screen.
  const nearby = useMemo(() => {
    if (!userLoc) return [];
    const visibleIds = new Set(filtered.map(c => c.id));
    const raw = rawCafes.filter(c => c.lat != null && c.lng != null && visibleIds.has(c.id));
    return raw
      .map(c => ({ c, km: bestKm(c, userLoc.lat, userLoc.lng, roadKmByCafe[c.id]) ?? Infinity }))
      .filter(x => Number.isFinite(x.km))
      .sort((a, b) => a.km - b.km);
  }, [rawCafes, userLoc, roadKmByCafe, filtered]);

  const nearestRaw = nearby[0]?.c;

  // Stable input for the mini-map so the iframe/WebView HTML only rebuilds when
  // the underlying nearby pins actually change (not on every parent re-render).
  const miniMapCafes = useMemo(
    () => nearby.slice(0, 8).map(({ c }) => ({ id: c.id, name: c.name, lat: c.lat as number, lng: c.lng as number })),
    [nearby],
  );

  // "Most used" — by the user's own order count per cafe, then by rating.
  const mostUsed = useMemo(() => {
    const prog = user?.cafeProgress ?? {};
    return [...filtered].sort((a, b) => {
      const ua = prog[a.id]?.totalOrders ?? 0;
      const ub = prog[b.id]?.totalOrders ?? 0;
      return ub - ua || (b.rating - a.rating);
    });
  }, [filtered, user?.cafeProgress]);

  const visibleUsed = showAllUsed ? mostUsed : mostUsed.slice(0, 4);

  const openDirections = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (nearestRaw?.lat != null && nearestRaw?.lng != null) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${nearestRaw.lat},${nearestRaw.lng}`;
      Linking.openURL(url).catch(() => openMap());
    } else {
      openMap();
    }
  }, [nearestRaw, openMap]);

  const chevron = lang === "ar" ? "chevron-left" : "chevron-right";
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const firstName = user?.name?.split(" ")[0] ?? t("common.guest");

  return (
    <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center" }]}>
     <View style={{ width: "100%", maxWidth: r.contentMaxWidth, flex: 1 }}>

      {/* ── Top action bar (language toggle) ── */}
      <View style={[styles.topBar, { paddingTop: topPadding + 10, paddingHorizontal: r.hPad }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(); }}
          activeOpacity={0.85}
          style={[styles.langBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          accessibilityLabel="Toggle language"
        >
          <Feather name="globe" size={14} color={colors.primary} />
          <Text style={[styles.langBtnText, { color: colors.primary }]}>
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
        {/* ── Profile / loyalty header ── */}
        <View style={styles.profileRow}>
          <View style={styles.profileLeft}>
            <View style={styles.avatarWrap}>
              <AvatarWithFrame size={58} scale={1.5}>
                <LinearGradient
                  colors={["#E8B86D", "#7A5A2E"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.avatarRing}
                >
                  <View style={[styles.avatarInner, { backgroundColor: colors.card }]}>
                    <Image
                      source={user?.avatar ? { uri: user.avatar } : getDefaultAvatarSource(user?.gender as ("male" | "female" | undefined))}
                      style={styles.avatarPhoto}
                      resizeMode="cover"
                    />
                  </View>
                </LinearGradient>
              </AvatarWithFrame>
              <View style={[styles.avatarLevelBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Text style={styles.avatarLevelText}>{level}</Text>
              </View>
            </View>

            <View style={styles.profileText}>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]} numberOfLines={1}>
                {t("home.greetingMorning")} 👋
              </Text>
              <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                {firstName} ☕
              </Text>
              <View style={styles.badgeRow}>
                <View style={[styles.lvPill, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                  <Text style={[styles.lvPillText, { color: colors.primary }]}>{rank.icon} Lv {level}</Text>
                </View>
              </View>
              <Text style={[styles.cravingPrompt, { color: colors.primary }]} numberOfLines={1}>
                {t("home.cravingPrompt")}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Search ── */}
        <View style={styles.searchRow}>
          <SearchBar value={search} onChangeText={setSearch} placeholder={t("home.searchPlaceholder")} />
        </View>

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{error}</Text>
          </View>
        ) : (
        <>
          {/* ── Directions to nearest cafe (compact) ── */}
          {nearestRaw && (
            <TouchableOpacity
              onPress={openDirections}
              activeOpacity={0.85}
              style={[styles.directionsChip, { borderColor: colors.primary, backgroundColor: colors.secondary }]}
            >
              <Feather name="navigation" size={13} color={colors.primary} />
              <Text style={[styles.directionsChipText, { color: colors.primary }]} numberOfLines={1}>
                {t("home.directionsNearest")}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Map preview ── */}
          <TouchableOpacity
            onPress={openMap}
            activeOpacity={0.92}
            style={[styles.mapPanel, { borderColor: colors.primary, backgroundColor: colors.card }]}
          >
            <View style={[styles.mapPanelMap, { borderColor: colors.border }]}>
              <MiniCafesMap cafes={miniMapCafes} user={userLoc} height={104} />
              <View style={[styles.mapPanelPill, { borderColor: colors.border }]}>
                <Feather name="maximize-2" size={11} color={colors.primary} />
                <Text style={[styles.mapPanelPillText, { color: colors.primary }]}>{t("home.viewFullMap")}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Cafes ── */}
          <View style={[styles.sectionHeader, { marginTop: 12 }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("home.cafesTitle")}</Text>
            {mostUsed.length > 4 && (
              <TouchableOpacity onPress={() => setShowAllUsed(v => !v)} activeOpacity={0.7} style={styles.linkRow}>
                <Text style={[styles.linkText, { color: colors.primary }]}>{t("home.viewAll")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {visibleUsed.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="coffee" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {apiCafes.length === 0 ? t("home.noCafesYet") : t("home.noResults")}
              </Text>
            </View>
          ) : (
            <View style={styles.cafeGrid}>
            {visibleUsed.map((cafe) => {
              const fav = isFavorite(cafe.id);
              return (
                <TouchableOpacity
                  key={cafe.id}
                  activeOpacity={0.92}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/cafe/${cafe.id}` as any); }}
                  style={[styles.featuredCard, { borderColor: colors.primary }]}
                >
                  <ImageBackground source={cafe.image} style={styles.featuredBg} imageStyle={styles.featuredBgImg}>
                    <LinearGradient
                      colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.45)", "rgba(10,6,6,0.96)"]}
                      locations={[0, 0.45, 1]}
                      style={StyleSheet.absoluteFill}
                    />

                    {/* Top row: status + favorite */}
                    <View style={styles.featuredTopRow}>
                      <View style={[styles.featuredStatus, { backgroundColor: cafe.isOpen ? colors.success : "rgba(0,0,0,0.55)" }]}>
                        <View style={[styles.statusDot, { backgroundColor: cafe.isOpen ? "#0A3A0A" : colors.mutedForeground }]} />
                        <Text style={[styles.featuredStatusText, { color: cafe.isOpen ? "#062406" : "#fff" }]}>
                          {cafe.isOpen ? t("home.openNow") : t("home.closedNow")}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleFav(cafe.id); }}
                        activeOpacity={0.85}
                        style={styles.heartBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="heart" size={18} color={fav ? "#FF5A7A" : "#fff"} style={fav ? styles.heartOn : undefined} />
                      </TouchableOpacity>
                    </View>

                    {/* Bottom content overlaid on the image */}
                    <View style={styles.featuredOverlay}>
                      <View style={styles.featuredTitleRow}>
                        <Text style={styles.featuredName} numberOfLines={1}>{cafe.name}</Text>
                        <Feather name="check-circle" size={16} color={colors.primary} />
                      </View>
                      <View style={styles.featuredBottomRow}>
                        <View style={styles.featuredMeta}>
                          <View style={styles.ratingChip}>
                            <Feather name="star" size={12} color={colors.gold} />
                            <Text style={styles.ratingChipText}>{cafe.rating}</Text>
                          </View>
                          {!!cafe.distance && (
                            <View style={styles.distChip}>
                              <Feather name="navigation" size={11} color={colors.primary} />
                              <Text style={styles.distChipText}>{cafe.distance}</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.orderBtn, { backgroundColor: colors.primary }]}>
                          <Text style={styles.orderBtnText}>{t("home.orderNow")}</Text>
                          <Feather name={chevron} size={15} color="#000" />
                        </View>
                      </View>
                    </View>
                  </ImageBackground>
                </TouchableOpacity>
              );
            })}
            </View>
          )}
        </>
        )}

        <View style={{ height: Platform.OS === "web" ? 110 : 100 }} />
      </ScrollView>
     </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Top bar
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8 },
  langBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
  },
  langBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: 6 },

  // Profile header
  profileRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  profileLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatarWrap: { width: 58, height: 58 },
  avatarRing: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  avatarInner: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarPhoto: { width: 50, height: 50, borderRadius: 25 },
  avatarLevelBadge: {
    position: "absolute", bottom: -2, right: -2,
    minWidth: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  avatarLevelText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#000" },
  profileText: { flex: 1 },
  greeting: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 1 },
  userName: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 6 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  lvPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  lvPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  cravingPrompt: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 6 },

  // Search row
  searchRow: { marginBottom: 18 },

  // Sections
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  linkRow: { paddingVertical: 2, paddingHorizontal: 2 },
  linkText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Map preview — compact themed panel
  mapPanel: {
    borderWidth: 1.5, borderRadius: 18, padding: 8, marginBottom: 12,
    shadowColor: "#E8B86D", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  mapPanelMap: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  mapPanelPill: {
    position: "absolute", bottom: 8, insetInlineEnd: 8,
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: "rgba(10,6,6,0.85)",
  },
  mapPanelPillText: { fontSize: 10, fontFamily: "Inter_700Bold" },

  // Compact "directions to nearest cafe" chip above the map
  directionsChip: {
    alignSelf: "flex-start",
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: 999,
    paddingVertical: 7, paddingHorizontal: 12,
    marginBottom: 10,
  },
  directionsChipText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  // Featured / most used cards — full-bleed cafe image with gradient overlay
  cafeGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  featuredCard: {
    width: "48.5%",
    borderWidth: 1.5, borderRadius: 22, overflow: "hidden", marginBottom: 14,
    shadowColor: "#E8B86D", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  featuredBg: { width: "100%", height: 176, justifyContent: "space-between" },
  featuredBgImg: { borderRadius: 21 },
  featuredTopRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 12,
  },
  featuredStatus: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  featuredStatusText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  heartBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  heartOn: {},
  featuredOverlay: { padding: 11, gap: 8 },
  featuredTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  featuredName: {
    fontSize: 15, fontFamily: "Inter_700Bold", flexShrink: 1, color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  featuredBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  featuredMeta: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  ratingChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  ratingChipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  distChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.3)",
  },
  distChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  orderBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    borderRadius: 11, paddingVertical: 8, paddingHorizontal: 12,
    shadowColor: "#E8B86D", shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  orderBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#000" },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular" },
});
