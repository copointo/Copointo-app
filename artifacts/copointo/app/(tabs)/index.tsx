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

/** Thousands-grouped integer (Hermes-safe — toLocaleString grouping is unreliable). */
function groupNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Rough walking time in minutes from a distance in km (~5 km/h). */
function walkMinutes(km: number): number {
  return Math.max(1, Math.round((km / 5) * 60));
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
  const [openOnly,    setOpenOnly]    = useState(false);
  const [showAllUsed, setShowAllUsed] = useState(false);
  const [rawCafes,    setRawCafes]    = useState<ApiCafe[]>([]);
  const [apiCafes,    setApiCafes]    = useState<Cafe[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [userLoc,     setUserLoc]     = useState<{ lat: number; lng: number } | null>(null);
  const [openingMap,  setOpeningMap]  = useState(false);
  const [fcCount,     setFcCount]     = useState(0);
  const locRequested = useRef(false);

  // ── Loyalty / level figures (truthful — wired to the real free-coffee cycle,
  // the same forward-progress signal the Copointo Hub uses) ──
  const level           = user?.level ?? 0;
  const points          = user?.points ?? 0;
  const rank            = getRank(level);
  const ordersThisLevel = level % DRINKS_PER_FREE_COFFEE;
  const cyclePct        = Math.round((ordersThisLevel / DRINKS_PER_FREE_COFFEE) * 100);
  const drinksToFree    = ordersThisLevel === 0 && level > 0 ? DRINKS_PER_FREE_COFFEE : DRINKS_PER_FREE_COFFEE - ordersThisLevel;

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

  // Available (unredeemed) free coffees → drives the "claim" badge.
  useEffect(() => {
    const phone = user?.phone;
    if (!phone) return;
    apiFetch<{ coffees: { redeemedAt: string | null }[] }>(
      `/free-coffees?phone=${encodeURIComponent(phone)}`,
    )
      .then((d) => setFcCount(d.coffees.filter((c) => !c.redeemedAt).length))
      .catch(() => { /* non-critical — leave at 0 */ });
  }, [user?.phone]);

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

  // Search + "open only" filter applied to every list on the screen.
  const filtered = useMemo(() =>
    apiCafes.filter(c =>
      (!openOnly || c.isOpen) &&
      (!search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase()) ||
        c.tags.some(tag => tag.includes(search)))
    ), [apiCafes, search, openOnly]);

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

      {/* ── Top action bar (globe / bell / gift) ── */}
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

        <View style={styles.topIcons}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/sent-gifts" as any); }}
            activeOpacity={0.85}
            style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            accessibilityLabel="Gifts"
          >
            <Feather name="gift" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/notifications" as any); }}
            activeOpacity={0.85}
            style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
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
              <LinearGradient
                colors={["#E8B86D", "#7A5A2E"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <View style={[styles.avatarInner, { backgroundColor: colors.card }]}>
                  <Image
                    source={require("@/assets/images/copointo-logo.png")}
                    style={styles.avatarImg}
                    resizeMode="contain"
                  />
                </View>
              </LinearGradient>
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
                <View style={styles.pointsRow}>
                  <Feather name="star" size={13} color={colors.gold} />
                  <Text style={[styles.pointsText, { color: colors.foreground }]}>
                    {groupNum(points)} <Text style={{ color: colors.mutedForeground }}>{t("home.points")}</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Loyalty / free-coffee card */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/game" as any); }}
            activeOpacity={0.9}
            style={[styles.loyaltyCard, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Text style={styles.loyaltyCup}>☕</Text>
            <Text style={[styles.loyaltyFrac, { color: colors.foreground }]}>
              {ordersThisLevel}/{DRINKS_PER_FREE_COFFEE}
            </Text>
            <Text style={[styles.loyaltyLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
              {t("home.freeCoffee")}
            </Text>
            <View style={[styles.claimBtn, { backgroundColor: fcCount > 0 ? colors.primary : colors.secondary }]}>
              <Text style={[styles.claimText, { color: fcCount > 0 ? "#000" : colors.primary }]}>
                {t("home.claim")}{fcCount > 0 ? ` (${fcCount})` : ""}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Level progress bar ── */}
        <View style={[styles.progressWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.progressTop}>
            <Text style={[styles.progressSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {t("home.drinksToFree", { count: drinksToFree })}
            </Text>
            <Text style={[styles.progressPct, { color: colors.primary }]}>{cyclePct}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View style={[styles.progressFill, { width: `${Math.max(cyclePct, 4)}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>

        {/* ── Search + filter ── */}
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder={t("home.searchPlaceholder")} />
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setOpenOnly(v => !v); }}
            activeOpacity={0.85}
            style={[styles.filterBtn, {
              borderColor: colors.border,
              backgroundColor: openOnly ? colors.primary : colors.card,
            }]}
            accessibilityLabel="Filter open cafes"
          >
            <Feather name="sliders" size={18} color={openOnly ? "#000" : colors.primary} />
          </TouchableOpacity>
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
          {/* ── Nearby cafes ── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("home.nearbyMe")}</Text>
            <TouchableOpacity onPress={openMap} activeOpacity={0.7} style={styles.linkRow}>
              {openingMap
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={[styles.linkText, { color: colors.primary }]}>{t("home.viewFullMap")}</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={openMap}
            activeOpacity={0.92}
            style={[styles.mapPreview, { borderColor: colors.border }]}
          >
            <MiniCafesMap cafes={miniMapCafes} user={userLoc} height={150} />
            <View style={styles.mapPreviewBadge}>
              <Feather name="maximize-2" size={12} color="#000" />
              <Text style={styles.mapPreviewBadgeText}>{t("home.viewFullMap")}</Text>
            </View>
          </TouchableOpacity>

          {nearby.slice(0, 3).map(({ c, km }) => {
            const cafe = apiCafes.find(x => x.id === c.id);
            const open = cafe?.isOpen ?? isOpen(c.openTime, c.closeTime);
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/cafe/${c.id}`); }}
                activeOpacity={0.85}
                style={[styles.nearbyRow, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Image
                  source={cafe?.image ?? require("@/assets/images/icon.png")}
                  style={styles.nearbyThumb}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nearbyName, { color: colors.foreground }]} numberOfLines={1}>{c.name}</Text>
                  <View style={styles.nearbyMeta}>
                    <View style={[styles.dot, { backgroundColor: open ? colors.success : colors.mutedForeground }]} />
                    <Text style={[styles.nearbyMetaText, { color: open ? colors.success : colors.mutedForeground }]}>
                      {open ? t("home.openNow") : t("home.closedNow")}
                    </Text>
                    <Feather name="navigation" size={11} color={colors.primary} style={{ marginStart: 8 }} />
                    <Text style={[styles.nearbyMetaText, { color: colors.mutedForeground }]}>{cafe?.distance}</Text>
                    <Feather name="clock" size={11} color={colors.mutedForeground} style={{ marginStart: 8 }} />
                    <Text style={[styles.nearbyMetaText, { color: colors.mutedForeground }]}>
                      {t("home.minutesShort", { count: walkMinutes(km) })}
                    </Text>
                  </View>
                </View>
                <Feather name={chevron} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}

          {nearestRaw && (
            <TouchableOpacity
              onPress={openDirections}
              activeOpacity={0.9}
              style={[styles.directionsBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="navigation" size={16} color="#000" />
              <Text style={styles.directionsText}>{t("home.directionsNearest")}</Text>
            </TouchableOpacity>
          )}

          {/* ── Most used cafes ── */}
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("home.mostUsed")}</Text>
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
            visibleUsed.map((cafe) => {
              const fav = isFavorite(cafe.id);
              return (
                <View key={cafe.id} style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.featuredImageWrap}>
                    <Image source={cafe.image} style={styles.featuredImage} resizeMode="cover" />
                    <View style={[styles.featuredStatus, { backgroundColor: cafe.isOpen ? colors.success : colors.muted }]}>
                      <Text style={[styles.featuredStatusText, { color: cafe.isOpen ? "#000" : colors.mutedForeground }]}>
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
                  <View style={styles.featuredContent}>
                    <View style={styles.featuredTitleRow}>
                      <Text style={[styles.featuredName, { color: colors.foreground }]} numberOfLines={1}>{cafe.name}</Text>
                      <Feather name="check-circle" size={15} color={colors.primary} />
                    </View>
                    <View style={styles.featuredMeta}>
                      <Feather name="star" size={13} color={colors.gold} />
                      <Text style={[styles.featuredMetaText, { color: colors.foreground }]}>{cafe.rating}</Text>
                      {!!cafe.distance && (
                        <>
                          <View style={[styles.dot, { backgroundColor: colors.mutedForeground, marginStart: 8 }]} />
                          <Feather name="navigation" size={12} color={colors.primary} style={{ marginStart: 8 }} />
                          <Text style={[styles.featuredMetaText, { color: colors.mutedForeground }]}>{cafe.distance}</Text>
                        </>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/cafe/${cafe.id}` as any); }}
                      activeOpacity={0.9}
                      style={[styles.orderBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.orderBtnText}>{t("home.orderNow")}</Text>
                      <Feather name={chevron} size={15} color="#000" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
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
  topIcons: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
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
  avatarImg: { width: 38, height: 38 },
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
  pointsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pointsText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Loyalty card
  loyaltyCard: { width: 96, borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", gap: 2 },
  loyaltyCup: { fontSize: 18 },
  loyaltyFrac: { fontSize: 18, fontFamily: "Inter_700Bold" },
  loyaltyLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  claimBtn: { marginTop: 6, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 12, alignSelf: "stretch", alignItems: "center" },
  claimText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  // Progress
  progressWrap: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 16 },
  progressTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  progressSub: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
  progressPct: { fontSize: 13, fontFamily: "Inter_700Bold", marginStart: 8 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },

  // Search row
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  filterBtn: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // Sections
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  linkRow: { paddingVertical: 2, paddingHorizontal: 2 },
  linkText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Map preview
  mapPreview: { borderWidth: 1, borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  mapPreviewBadge: {
    position: "absolute", bottom: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#E8B86D", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  mapPreviewBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#000" },

  // Nearby rows
  nearbyRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 10,
  },
  nearbyThumb: { width: 50, height: 50, borderRadius: 12, backgroundColor: "#1A1010" },
  nearbyName: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 },
  nearbyMeta: { flexDirection: "row", alignItems: "center" },
  nearbyMetaText: { fontSize: 11, fontFamily: "Inter_500Medium", marginStart: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },

  directionsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderRadius: 14, paddingVertical: 14, marginTop: 4,
  },
  directionsText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },

  // Featured / most used cards
  featuredCard: { borderWidth: 1, borderRadius: 18, overflow: "hidden", marginBottom: 14 },
  featuredImageWrap: { width: "100%", height: 150 },
  featuredImage: { width: "100%", height: 150 },
  featuredStatus: { position: "absolute", top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  featuredStatusText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  heartBtn: {
    position: "absolute", top: 8, right: 8,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
  },
  heartOn: {},
  featuredContent: { padding: 14, gap: 8 },
  featuredTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  featuredName: { fontSize: 16, fontFamily: "Inter_700Bold", flexShrink: 1 },
  featuredMeta: { flexDirection: "row", alignItems: "center" },
  featuredMetaText: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginStart: 4 },
  orderBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 12, paddingVertical: 11, marginTop: 4,
  },
  orderBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular" },
});
