import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { apiFetch } from "@/constants/api";
import { useT } from "@/context/LanguageContext";
import { useApp } from "@/context/AppContext";

interface ApiCafe {
  id: string; name: string; logo: string; image: string;
  openTime: string; closeTime: string; rating: number; ratingCount?: number;
  tags: string[]; address: string;
  lat?: number; lng?: number;
}

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";

/**
 * Build a self-contained Leaflet HTML page that:
 *   - shows OpenStreetMap tiles
 *   - plots one pin per cafe (with lat/lng)
 *   - plots the user's location
 *   - on pin tap: posts `{ type: "cafe", id }` back via either
 *     `ReactNativeWebView.postMessage` (native) or `window.parent.postMessage` (web iframe)
 *
 * Coordinates that fall outside Oman still render fine — Leaflet auto-fits
 * to the marker bounds. If a cafe has no lat/lng it is silently skipped.
 */
/**
 * Serialize JSON for safe embedding inside an HTML <script> tag. Escapes:
 *   - `</` so a cafe field cannot terminate the script tag (XSS hardening).
 *   - U+2028 / U+2029 which are valid in JSON but break JS parsers.
 * This lets us interpolate untrusted cafe names/addresses without a CSP.
 */
function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/<\/(script)/gi, "<\\/$1")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildMapHtml(opts: {
  cafes: { id: string; name: string; lat: number; lng: number; image?: string }[];
  user: { lat: number; lng: number } | null;
  youLabel: string;
}): string {
  const cafesJson = safeJsonForScript(opts.cafes);
  const userJson  = safeJsonForScript(opts.user);
  const youLabelJson = safeJsonForScript(opts.youLabel);
  return `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin="" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; background: #000; }
  .cafe-pin {
    width: 44px; height: 44px; border-radius: 50%;
    background: #E8B86D; border: 3px solid #fff;
    box-shadow: 0 4px 10px rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; cursor: pointer; overflow: hidden;
  }
  .cafe-pin img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .me-pin {
    width: 18px; height: 18px; border-radius: 50%;
    background: #4285F4; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(66,133,244,0.25);
  }
  .leaflet-popup-content-wrapper {
    background: #0A0606; color: #fff; border: 1px solid rgba(232,184,109,0.4);
    border-radius: 12px;
  }
  .leaflet-popup-tip { background: #0A0606; }
  .leaflet-popup-content { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 14px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossorigin=""></script>
<script>
  var cafes = ${cafesJson};
  var me    = ${userJson};

  // Default center: Muscat, Oman (works as a fallback when there are zero pins)
  var center = me ? [me.lat, me.lng]
              : cafes.length ? [cafes[0].lat, cafes[0].lng]
              : [23.5859, 58.4059];

  var map = L.map('map', { zoomControl: true, attributionControl: false })
              .setView(center, 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map);

  function send(payload) {
    var msg = JSON.stringify(payload);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(msg);
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  }

  // User pin
  if (me) {
    L.marker([me.lat, me.lng], {
      icon: L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
    }).addTo(map).bindPopup(${youLabelJson});
  }

  // Cafe pins
  var bounds = me ? [[me.lat, me.lng]] : [];
  cafes.forEach(function (c) {
    var img = (c.image && (c.image.indexOf('http') === 0 || c.image.indexOf('data:') === 0))
      ? c.image.replace(/"/g, '%22')
      : null;
    var inner = img
      ? '<div class="cafe-pin"><img src="' + img + '" onerror="this.parentNode.textContent=\\'☕\\'" /></div>'
      : '<div class="cafe-pin">☕</div>';
    var icon = L.divIcon({
      className: '',
      html: inner,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
    var m = L.marker([c.lat, c.lng], { icon: icon }).addTo(map);
    m.on('click', function () {
      send({ type: 'cafe', id: c.id });
    });
    bounds.push([c.lat, c.lng]);
  });

  // Auto-fit to all markers (with padding) when we have at least 2 points
  if (bounds.length >= 2) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }

  // Tell the host the map is ready (helps for loading-state UI)
  send({ type: 'ready', count: cafes.length });
</script>
</body>
</html>`;
}

export default function CafesMapScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const { t } = useT();
  const { user } = useApp();

  const [cafes,    setCafes]    = useState<ApiCafe[]>([]);
  const [userLoc,  setUserLoc]  = useState<{ lat: number; lng: number } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<ApiCafe | null>(null);

  // Fetch cafes (sorted by rating from server) + best-effort current location
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Location is best-effort: the home-screen button already requested
        // permission, so on second visits this resolves silently.
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            if (alive) setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        } catch { /* ignore */ }

        const data = await apiFetch<{ cafes: ApiCafe[] }>(
          user ? `/cafes?userId=${encodeURIComponent(user.id)}` : "/cafes"
        );
        if (alive) setCafes(data.cafes);
      } catch {
        if (alive) setError(t("cafesMap.errorLoad"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cafes that actually have coordinates (the map can only plot those)
  const plottable = useMemo(
    () => cafes.filter(c => c.lat != null && c.lng != null) as Array<ApiCafe & { lat: number; lng: number }>,
    [cafes]
  );

  const youLabel = t("cafesMap.youLabel");
  const html = useMemo(
    () => buildMapHtml({
      cafes: plottable.map(c => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, image: c.image })),
      user:  userLoc,
      youLabel,
    }),
    [plottable, userLoc, youLabel]
  );

  // ── Message handler (native WebView) ───────────────────────────────────
  const handleMessage = useCallback((rawData: string) => {
    try {
      const data = JSON.parse(rawData);
      if (data?.type === "cafe" && data.id) {
        const c = cafes.find(x => x.id === data.id);
        if (c) setSelected(c);
      }
    } catch { /* ignore malformed messages */ }
  }, [cafes]);

  // ── Web iframe message bridge ──────────────────────────────────────────
  // We hold a ref to the iframe so we can validate that messages actually
  // come from our own map iframe (not from another window injecting events).
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onMsg = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      // Only trust messages from our own iframe (`srcDoc` iframes have a
      // null/opaque origin so we compare source windows directly).
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      handleMessage(e.data);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [handleMessage]);

  const goToCafe = (cafeId: string) => {
    setSelected(null);
    router.push(`/cafe/${cafeId}` as any);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t("cafesMap.title")}</Text>
          <Text style={styles.headerSub}>
            {loading ? t("cafesMap.loadingShort") : t("cafesMap.subtitle", { n: plottable.length })}
          </Text>
        </View>
      </View>

      {/* ── Map ── */}
      <View style={styles.mapWrap}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Feather name="wifi-off" size={40} color="rgba(255,255,255,0.4)" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : plottable.length === 0 ? (
          <View style={styles.center}>
            <Feather name="map-pin" size={40} color="rgba(255,255,255,0.4)" />
            <Text style={styles.errorText}>{t("cafesMap.noCoords")}</Text>
          </View>
        ) : Platform.OS === "web" ? (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            style={{ border: 0, width: "100%", height: "100%" }}
            title="cafes-map"
            sandbox="allow-scripts"
          />
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={{ flex: 1, backgroundColor: BG }}
            onMessage={(e) => handleMessage(e.nativeEvent.data)}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
          />
        )}
      </View>

      {/* ── Selected-cafe panel (bottom sheet) ── */}
      {selected && (
        <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetRow}>
              <View style={styles.sheetLogo}>
                {selected.logo && (selected.logo.startsWith("http") || selected.logo.startsWith("data:"))
                  ? <Image source={{ uri: selected.logo }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                  : <Text style={{ fontSize: 24 }}>{selected.logo || "☕"}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetName} numberOfLines={1}>{selected.name}</Text>
                <Text style={styles.sheetAddress} numberOfLines={2}>{selected.address}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.sheetClose} activeOpacity={0.7}>
                <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => goToCafe(selected.id)}
              style={styles.sheetCta}
              activeOpacity={0.85}
            >
              <Feather name="external-link" size={16} color="#fff" />
              <Text style={styles.sheetCtaText}>{t("cafesMap.visitCafe")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)",
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: CARD, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: BORDER,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 2 },

  mapWrap: { flex: 1, backgroundColor: BG },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", textAlign: "center" },

  sheetWrap: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 8,
  },
  sheet: {
    backgroundColor: CARD, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: -6 }, elevation: 14,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center", marginBottom: 14,
  },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  sheetLogo: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  sheetName:    { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 2 },
  sheetAddress: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  sheetClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  sheetCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14,
  },
  sheetCtaText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
});
