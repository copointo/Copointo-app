import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Loader2, MapPin } from "lucide-react";

// Fix default marker icon paths (Leaflet's bundled icons break under Vite).
// Using CDN URLs avoids needing to import the asset files.
const DefaultIcon = L.icon({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationPickerProps {
  /** Current lat (string from form). */
  lat: string;
  /** Current lng (string from form). */
  lng: string;
  /** Called whenever the user picks a new location. */
  onChange: (lat: string, lng: string) => void;
  /** Default centre when no lat/lng is set yet. Muscat by default. */
  defaultCenter?: [number, number];
}

/**
 * Interactive map picker:
 *  - Search bar (OpenStreetMap Nominatim, no API key).
 *  - Draggable marker; clicking the map also moves the marker.
 *  - Calls `onChange(lat, lng)` whenever the marker moves.
 *
 * Replaces the old "paste Google Maps URL" field so super-admins can pick
 * the cafe's exact spot visually and the saved coordinates always land on
 * the right place.
 */
export default function LocationPicker({
  lat, lng, onChange,
  defaultCenter = [23.5880, 58.4080], // Muscat
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markerRef    = useRef<L.Marker | null>(null);

  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [busy,     setBusy]     = useState(false);
  const [openList, setOpenList] = useState(false);

  // Initial map setup — runs once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const startLat = Number(lat) || defaultCenter[0];
    const startLng = Number(lng) || defaultCenter[1];

    const map = L.map(containerRef.current, {
      center: [startLat, startLng],
      zoom: lat && lng ? 16 : 12,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([startLat, startLng], { draggable: true, icon: DefaultIcon }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onChange(p.lat.toFixed(6), p.lng.toFixed(6));
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChange(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
    });

    mapRef.current    = map;
    markerRef.current = marker;

    // Leaflet sometimes initialises with the wrong size when the container
    // becomes visible after a transition / inside a modal. Re-measure shortly
    // after mount.
    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      map.remove();
      mapRef.current    = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker when external lat/lng change (e.g. user typed in another
  // place, or the picker re-opens for editing an existing cafe).
  useEffect(() => {
    const map = mapRef.current, marker = markerRef.current;
    if (!map || !marker) return;
    const nLat = Number(lat), nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return;
    const cur = marker.getLatLng();
    if (Math.abs(cur.lat - nLat) < 1e-6 && Math.abs(cur.lng - nLng) < 1e-6) return;
    marker.setLatLng([nLat, nLng]);
    map.setView([nLat, nLng], Math.max(map.getZoom(), 15));
  }, [lat, lng]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "Accept-Language": "ar,en" } });
      const data = await res.json() as SearchResult[];
      setResults(data);
      setOpenList(true);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const pickResult = (r: SearchResult) => {
    const nLat = Number(r.lat), nLng = Number(r.lon);
    onChange(nLat.toFixed(6), nLng.toFixed(6));
    setOpenList(false);
    setQuery(r.display_name);
  };

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
          <Search size={15} className="text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
            onFocus={() => results.length > 0 && setOpenList(true)}
            placeholder="ابحث عن مكان الكوفي (مثلاً: مسقط، شارع الروي)"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={busy}
            className="text-xs font-semibold text-primary disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : "بحث"}
          </button>
        </div>

        {/* Results dropdown */}
        {openList && results.length > 0 && (
          <div className="absolute z-[1000] mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-input bg-popover shadow-lg">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickResult(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-right text-xs hover:bg-accent"
              >
                <MapPin size={13} className="mt-0.5 shrink-0 text-primary" />
                <span className="line-clamp-2">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        className="h-[280px] w-full overflow-hidden rounded-lg border border-input"
      />

      {/* Coordinates readout */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin size={11} className="text-primary" />
          اسحب الدبوس أو انقر على الخريطة لتحديد المكان
        </span>
        {lat && lng && (
          <span dir="ltr" className="font-mono">
            {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}
