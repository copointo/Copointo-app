---
name: Copointo web head/SEO injection
description: Why serve.js (not +html.tsx) is the only reliable place to set favicon/OG/JSON-LD on the deployed Copointo web app.
---

# Copointo web SEO/social/favicon tags live in serve.js, not +html.tsx

The Copointo web build is a **pure Expo Router SPA** (no static prerender / no
`output: "static"`). Expo's web export emits a **minimal `index.html`** that does
**NOT** honor most of `app/+html.tsx`'s custom `<head>`. In practice only a basic
`<title>`/description survive; favicon links, Open Graph tags, Twitter tags,
canonical, and JSON-LD added to `+html.tsx` simply **never appear** in the served
HTML.

**Why:** confirmed empirically — `+html.tsx` contained favicon + og:image +
Organization/WebSite JSON-LD, the app was (re)published, yet curling
`https://copointo.com/` (Googlebot UA) showed none of them. Title/description were
present only because `server/serve.js` patches them at the HTTP layer.

**How to apply:**
- The deployed web HTML is patched at runtime by `artifacts/copointo/server/serve.js`
  (`buildHtmlForRoute`). That is the **single source of truth** for what crawlers
  and social scrapers actually see. Treat `+html.tsx` as effectively unused for the
  SPA shell (keep it correct for future static-rendering, but don't rely on it).
- serve.js must **UPSERT** tags (replace-if-present, else inject before `</head>`).
  A plain `.replace()` silently no-ops when the tag is absent (which it always is
  for og/favicon/JSON-LD). Helpers: `setMeta`, `setLink`, `ensureBrandAssets`.
- `og:image` / `twitter:image` MUST be **absolute** (`https://copointo.com/...`)
  or WhatsApp/Twitter/Facebook drop the preview image.
- Brand logo in Google search results comes from the **Organization JSON-LD `logo`**
  (absolute URL), injected on the home page by `ensureBrandAssets`.
- serve.js only takes effect after **republish**; the copointo dev workflow runs the
  Expo dev server, not serve.js, so verify with `curl -A Googlebot https://copointo.com/`
  AFTER publishing, not locally.
