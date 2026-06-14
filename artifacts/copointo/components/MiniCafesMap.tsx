import React, { useMemo } from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";

interface MiniCafe { id: string; name: string; lat: number; lng: number }

/** Serialize JSON for safe embedding inside an inline <script>. Mirrors the
 *  hardening in app/cafes-map.tsx: escapes `</script`, U+2028 and U+2029 so an
 *  untrusted cafe name/field cannot break out of the script tag. */
function safeJson(v: unknown): string {
  return JSON.stringify(v ?? null)
    .replace(/<\/(script)/gi, "<\\/$1")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** A small, non-interactive Leaflet/OSM map used as a tappable preview on the
 *  home screen. Dragging / zooming are disabled — the parent wraps it in a
 *  TouchableOpacity that opens the full-screen map. Mirrors the styling used by
 *  app/cafes-map.tsx (gold cafe pins, blue "me" dot, dark popups). */
function buildHtml(cafes: MiniCafe[], user: { lat: number; lng: number } | null): string {
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
  .leaflet-control-container { display: none; }
  .cafe-pin {
    width: 30px; height: 30px; border-radius: 50%;
    background: #E8B86D; border: 3px solid #fff;
    box-shadow: 0 4px 10px rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center; font-size: 15px;
  }
  .me-pin {
    width: 16px; height: 16px; border-radius: 50%;
    background: #4285F4; border: 3px solid #fff;
    box-shadow: 0 0 0 5px rgba(66,133,244,0.25);
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossorigin=""></script>
<script>
  var cafes = ${safeJson(cafes)};
  var me    = ${safeJson(user)};
  var center = me ? [me.lat, me.lng]
              : cafes.length ? [cafes[0].lat, cafes[0].lng]
              : [23.5859, 58.4059];
  var map = L.map('map', {
    zoomControl: false, attributionControl: false,
    dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, tap: false, touchZoom: false,
  }).setView(center, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  if (me) {
    L.marker([me.lat, me.lng], {
      icon: L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
    }).addTo(map);
  }
  var bounds = me ? [[me.lat, me.lng]] : [];
  cafes.forEach(function (c) {
    L.marker([c.lat, c.lng], {
      icon: L.divIcon({ className: '', html: '<div class="cafe-pin">\u2615</div>', iconSize: [30, 30], iconAnchor: [15, 15] })
    }).addTo(map);
    bounds.push([c.lat, c.lng]);
  });
  if (bounds.length >= 2) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
</script>
</body>
</html>`;
}

export function MiniCafesMap({
  cafes,
  user,
  height = 150,
}: {
  cafes: MiniCafe[];
  user: { lat: number; lng: number } | null;
  height?: number;
}) {
  const html = useMemo(() => buildHtml(cafes, user), [cafes, user]);

  return (
    <View pointerEvents="none" style={{ height, width: "100%" }}>
      {Platform.OS === "web" ? (
        <iframe
          srcDoc={html}
          title="mini-cafes-map"
          sandbox="allow-scripts"
          style={{ border: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />
      ) : (
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          style={{ flex: 1, backgroundColor: "#000" }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          pointerEvents="none"
        />
      )}
    </View>
  );
}
