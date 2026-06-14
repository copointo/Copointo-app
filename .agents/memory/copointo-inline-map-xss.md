---
name: Copointo inline-HTML map embeds
description: Hardened JSON serialization rule when injecting cafe data into inline <script> in WebView/iframe maps.
---

Any component that builds Leaflet/OSM HTML and injects server-provided cafe
fields (name/address/coords) into an inline `<script>` (WebView on native,
iframe `srcDoc` on web) MUST serialize with the hardened serializer used by
`app/cafes-map.tsx::safeJsonForScript`:

- escape `</script` → `<\/script`
- escape U+2028 / U+2029

**Why:** cafe names are user/admin-supplied. Escaping only `<` (a naive
serializer) still lets a crafted `</script>` break out of the tag → XSS on web.
Caught in code review when `components/MiniCafesMap.tsx` was first added with a
weaker serializer than the full-screen map.

**How to apply:** when adding a new map preview/embed, copy the serializer from
cafes-map verbatim; don't hand-roll a `<`-only escape. Also memoize the cafe
array passed to the embed so the iframe/WebView HTML doesn't rebuild every
parent re-render (jank inside a ScrollView).
