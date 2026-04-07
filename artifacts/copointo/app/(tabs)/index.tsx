import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CafeCard } from "@/components/CafeCard";
import { SearchBar } from "@/components/SearchBar";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
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

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} م`;
  return `${km.toFixed(1)} كم`;
}

function mapCafe(c: ApiCafe, userLat?: number, userLng?: number): Cafe {
  let distance = "";
  if (userLat != null && userLng != null && c.lat != null && c.lng != null) {
    distance = formatDist(haversineKm(userLat, userLng, c.lat, c.lng));
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
  const { user } = useApp();
  const [search,      setSearch]      = useState("");
  const [rawCafes,    setRawCafes]    = useState<ApiCafe[]>([]);
  const [apiCafes,    setApiCafes]    = useState<Cafe[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [userLoc,     setUserLoc]     = useState<{ lat: number; lng: number } | null>(null);
  const locRequested = useRef(false);

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

  // Re-map cafes whenever raw data or user location changes
  useEffect(() => {
    setApiCafes(rawCafes.map(c => mapCafe(c, userLoc?.lat, userLoc?.lng)));
  }, [rawCafes, userLoc]);

  const fetchCafes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ cafes: ApiCafe[] }>("/cafes");
      setRawCafes(data.cafes);
    } catch {
      setError("تعذّر تحميل الكوفيهات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>صباح الخير،</Text>
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {user?.name?.split(" ")[0] ?? "ضيف"} ☕
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchCafes(true)} tintColor={colors.foreground} />
        }
      >
        <View style={styles.searchWrapper}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث عن كوفي..." />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الكوفيهات القريبة</Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>{filtered.length} كوفي</Text>
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
              {apiCafes.length === 0 ? "لا توجد كوفيهات بعد" : "لا توجد نتائج"}
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
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 20, paddingBottom: 12 },
  greeting:      { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  userName:      { fontSize: 22, fontFamily: "Inter_700Bold" },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  searchWrapper: { marginBottom: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle:  { fontSize: 18, fontFamily: "Inter_700Bold" },
  count:         { fontSize: 13, fontFamily: "Inter_400Regular" },
  empty:         { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText:     { fontSize: 16, fontFamily: "Inter_400Regular" },
  grid:          { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridItem:      { width: "48%" },
});
