// Free geocoding via OpenStreetMap Nominatim — no API key required.
// Adds Oman context to bias results toward the country.

const cache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address) return null;
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  try {
    const q = encodeURIComponent(`${address}, Oman`);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=om`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Copointo/1.0 (cafe-locator)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) { cache.set(key, null); return null; }
    const data = (await r.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) { cache.set(key, null); return null; }
    const result = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}
