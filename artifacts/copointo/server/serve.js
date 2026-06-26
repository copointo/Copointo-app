/**
 * Standalone production server for Expo static builds.
 *
 * Serves three things from ./static-build/:
 * - GET /manifest with expo-platform: ios|android  → platform manifest JSON
 *   (also GET / with that header, for compatibility).
 * - GET / from a browser                           → web SPA (static-build/web/index.html)
 * - All other paths                                → static files, web first then expo bundle dirs
 *
 * Zero external dependencies — uses only Node.js built-ins.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const API_UPSTREAM = "https://copointo-api.onrender.com";

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const WEB_ROOT = path.join(STATIC_ROOT, "web");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

/**
 * Top-level SPA route prefixes derived from the Expo Router file tree.
 * Any browser request whose pathname does NOT start with one of these (and is
 * not a static asset) is genuinely unknown and should receive a real 404.
 */
const KNOWN_ROUTE_PREFIXES = [
  "/",
  "/videos",
  "/cafes-map",
  "/game",
  "/leaderboard",
  "/cafe/",
  "/add-friend",
  "/buy-coins",
  "/cart",
  "/collection",
  "/communities",
  "/community-info",
  "/community-invites",
  "/competitor-profile",
  "/conversation",
  "/create-community",
  "/create-group",
  "/flappy-copointo",
  "/group-info",
  "/levels",
  "/messages",
  "/my-cafes",
  "/notifications",
  "/order-timer",
  "/play-win",
  "/privacy",
  "/profile",
  "/sent-gifts",
  "/store",
  "/support",
];

/**
 * Routes that are entirely behind the auth gate and therefore must not be
 * indexed. The server adds `X-Robots-Tag: noindex` for these paths so
 * crawlers that cannot sign in do not index a login-wall page.
 *
 * "/" is intentionally excluded — the landing page is indexable.
 * "/videos", "/cafes-map", "/game", and "/leaderboard" are intentionally
 * excluded — they are public-facing pages listed in sitemap.xml and should
 * be indexed. They do require sign-in inside the app, but their initial HTML
 * (served before JS runs) provides enough content for crawlers.
 */
const NOINDEX_ROUTE_PREFIXES = [
  "/cafe/",
  "/add-friend",
  "/buy-coins",
  "/cart",
  "/collection",
  "/communities",
  "/community-info",
  "/community-invites",
  "/competitor-profile",
  "/conversation",
  "/create-community",
  "/create-group",
  "/flappy-copointo",
  "/group-info",
  "/levels",
  "/messages",
  "/my-cafes",
  "/notifications",
  "/order-timer",
  "/play-win",
  "/privacy",
  "/profile",
  "/sent-gifts",
  "/store",
  "/support",
];

/**
 * Per-route meta overrides injected into the index.html shell before serving.
 *
 * This is the canonical source of per-route SEO metadata for the Copointo web
 * app. Because the app is an Expo Router SPA (no `output: "static"` prerender),
 * `+html.tsx` emits one shared HTML shell with home-page defaults. This server
 * overrides title, description, canonical, og:url, og:title, og:description,
 * Twitter card tags, and injects a route-specific WebPage JSON-LD block on
 * every HTTP response for the five public indexable routes — so crawlers and
 * social bots receive the correct metadata in the initial HTML without needing
 * to execute JavaScript.
 *
 * IMPORTANT: keep this map in sync with:
 *   - artifacts/copointo/app/_layout.tsx  ROUTE_META  (client-side SPA update)
 *   - artifacts/copointo/public/sitemap.xml            (crawler discovery)
 */
const ROUTE_META = {
  "/": {
    title: "Copointo — دليل الكوفيهات في سلطنة عمان",
    description:
      "كوبوينتو — دليلك الأول لعالم الكوفيهات في سلطنة عمان ☕ تصفّح أجمل الكوفيهات، اطلب مشروبك المفضّل، احجز طاولتك، واجمع نقاط الولاء.",
    canonical: "https://copointo.com/",
    ogUrl: "https://copointo.com/",
    jsonLdType: "WebSite",
  },
  "/videos": {
    title: "ريلز الكوفيهات | Copointo",
    description:
      "اكتشف أجمل مقاطع فيديو الكوفيهات في سلطنة عمان. شاهد ريلز حصرية من أبرز الكوفيهات العُمانية عبر منصة كوبوينتو.",
    canonical: "https://copointo.com/videos",
    ogUrl: "https://copointo.com/videos",
    jsonLdType: "CollectionPage",
  },
  "/cafes-map": {
    title: "خريطة الكوفيهات | Copointo",
    description:
      "اعثر على أقرب كوفيه إليك في سلطنة عمان. استعرض خريطة تفاعلية لجميع الكوفيهات المسجّلة في منصة كوبوينتو.",
    canonical: "https://copointo.com/cafes-map",
    ogUrl: "https://copointo.com/cafes-map",
    jsonLdType: "WebPage",
  },
  "/game": {
    title: "الألعاب والنقاط | Copointo",
    description:
      "العب واجمع نقاط كوبوينتو. استمتع بتجربة الولاء والمستويات والمكافآت في منصة كوبوينتو لعشاق القهوة في عمان.",
    canonical: "https://copointo.com/game",
    ogUrl: "https://copointo.com/game",
    jsonLdType: "WebPage",
  },
  "/leaderboard": {
    title: "لوحة الشرف | Copointo",
    description:
      "تنافس مع أبرز عشاق القهوة في عمان. استعرض لوحة شرف كوبوينتو وتعرّف على أعلى المستخدمين نقاطاً وأكثرهم ولاءً.",
    canonical: "https://copointo.com/leaderboard",
    ogUrl: "https://copointo.com/leaderboard",
    jsonLdType: "WebPage",
  },
};

function isKnownRoute(pathname) {
  const p = pathname === "" ? "/" : pathname;
  return KNOWN_ROUTE_PREFIXES.some(
    (prefix) =>
      prefix === "/"
        ? p === "/"
        : p === prefix || p.startsWith(prefix.endsWith("/") ? prefix : prefix + "/") || p === prefix
  );
}

function isNoindexRoute(pathname) {
  return NOINDEX_ROUTE_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix.endsWith("/") ? prefix : prefix + "/")
  );
}

/**
 * Inject route-specific meta tags into the built index.html shell.
 *
 * Patches in-place: <title>, meta[name=description], link[rel=canonical],
 * og:title, og:description, og:url, twitter:title, twitter:description.
 *
 * For non-home routes it also appends a route-specific WebPage JSON-LD
 * block just before </head> so structured-data crawlers (Google, Bing) see
 * a page-level schema without needing to execute JavaScript.
 */
const SITE_ORIGIN = "https://copointo.com";
const LOGO_ABS = `${SITE_ORIGIN}/copointo-logo.png`;

/**
 * Upsert a <meta> tag: replace its content if the tag already exists, else
 * inject a fresh tag before </head>. Needed because the Expo SPA export emits
 * a minimal index.html that lacks most SEO/social tags (it does NOT honour the
 * full +html.tsx <head>), so a plain .replace() would silently no-op.
 */
function setMeta(html, attr, key, content) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, "i");
  if (re.test(html)) return html.replace(re, `$1${content}$2`);
  return html.replace("</head>", `  <meta ${attr}="${key}" content="${content}" />\n</head>`);
}

/** Upsert a <link rel=...> tag (replace href if present, else inject). */
function setLink(html, rel, href, extraAttrs = "") {
  const re = new RegExp(`(<link\\s+rel="${rel}"[^>]*href=")[^"]*(")`, "i");
  if (re.test(html)) return html.replace(re, `$1${href}$2`);
  const extra = extraAttrs ? ` ${extraAttrs}` : "";
  return html.replace("</head>", `  <link rel="${rel}"${extra} href="${href}" />\n</head>`);
}

/**
 * Ensure the Copointo brand favicon + logo schema are present on every served
 * page, regardless of whether the Expo build emitted them. This is what makes
 * the logo appear (a) in the browser tab, (b) next to the site in Google search
 * results (Organization schema `logo`), and (c) in WhatsApp/Twitter/Facebook
 * link previews (og:image, absolute URL).
 */
function ensureBrandAssets(html, includeOrgSchema) {
  let out = html;

  if (!/rel="icon"/i.test(out)) {
    out = out.replace(
      "</head>",
      `  <link rel="icon" type="image/png" href="/copointo-logo.png" />\n` +
        `  <link rel="apple-touch-icon" href="/copointo-logo.png" />\n</head>`
    );
  }

  // og:image / twitter:image MUST be absolute or social scrapers drop them.
  out = setMeta(out, "property", "og:image", LOGO_ABS);
  out = setMeta(out, "name", "twitter:image", LOGO_ABS);

  // Organization + WebSite schema (with absolute `logo`) — the signal Google
  // uses to show the brand logo beside the site. Inject once, on the home page.
  if (includeOrgSchema && !/"@type":\s*"Organization"/.test(out)) {
    const org = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Copointo",
      alternateName: "كوبوينتو",
      url: `${SITE_ORIGIN}/`,
      logo: LOGO_ABS,
      image: LOGO_ABS,
      areaServed: "OM",
      sameAs: ["https://www.instagram.com/copointo._"],
    });
    const site = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Copointo",
      alternateName: "كوبوينتو",
      url: `${SITE_ORIGIN}/`,
      inLanguage: "ar-OM",
      publisher: {
        "@type": "Organization",
        name: "Copointo",
        url: `${SITE_ORIGIN}/`,
        logo: { "@type": "ImageObject", url: LOGO_ABS },
      },
    });
    out = out.replace(
      "</head>",
      `  <script type="application/ld+json">${org}</script>\n` +
        `  <script type="application/ld+json">${site}</script>\n</head>`
    );
  }

  return out;
}

function buildHtmlForRoute(html, pathname) {
  // Normalize trailing slash so /videos/ resolves the same as /videos.
  const key = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  const meta = ROUTE_META[key];

  // Brand favicon + absolute social image apply to EVERY served page. The
  // Organization/WebSite logo schema is injected only on the home page.
  let out = ensureBrandAssets(html, pathname === "/" || pathname === "");
  if (!meta) return out;

  // Title (the SPA shell always has a <title>, so replace is enough; fall back
  // to injection just in case).
  if (/<title>[^<]*<\/title>/i.test(out)) {
    out = out.replace(/<title>[^<]*<\/title>/i, `<title>${meta.title}</title>`);
  } else {
    out = out.replace("</head>", `  <title>${meta.title}</title>\n</head>`);
  }

  out = setMeta(out, "name", "description", meta.description);
  out = setLink(out, "canonical", meta.canonical);
  out = setMeta(out, "property", "og:type", "website");
  out = setMeta(out, "property", "og:site_name", "Copointo");
  out = setMeta(out, "property", "og:title", meta.title);
  out = setMeta(out, "property", "og:description", meta.description);
  out = setMeta(out, "property", "og:url", meta.ogUrl);
  out = setMeta(out, "property", "og:locale", "ar_OM");
  out = setMeta(out, "name", "twitter:card", "summary_large_image");
  out = setMeta(out, "name", "twitter:title", meta.title);
  out = setMeta(out, "name", "twitter:description", meta.description);

  // For non-home routes inject a route-specific WebPage/CollectionPage JSON-LD
  // block. The home route gets Organization + WebSite from ensureBrandAssets.
  if (pathname !== "/") {
    const webPageJsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": meta.jsonLdType || "WebPage",
      name: meta.title,
      description: meta.description,
      url: meta.canonical,
      inLanguage: "ar-OM",
      isPartOf: { "@type": "WebSite", url: `${SITE_ORIGIN}/`, name: "Copointo" },
    });
    out = out.replace(
      "</head>",
      `<script type="application/ld+json">${webPageJsonLd}</script></head>`
    );
  }

  return out;
}

const NOT_FOUND_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>404 — الصفحة غير موجودة | Copointo</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, sans-serif; background: #000; color: #E8B86D;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
    h1 { font-size: 28px; margin: 0 0 12px; }
    p  { color: #fff; font-size: 16px; margin: 0 0 20px; }
    a  { color: #E8B86D; font-size: 15px; }
  </style>
</head>
<body>
  <div>
    <h1>404 — الصفحة غير موجودة</h1>
    <p>هذه الصفحة غير موجودة أو تمت إزالتها.</p>
    <a href="/">العودة إلى كوبوينتو</a>
  </div>
</body>
</html>`;

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Manifest not found for platform: ${platform}` }));
    return;
  }
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function sendFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

function tryServeFrom(roots, urlPath, res) {
  const safe = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  for (const root of roots) {
    const filePath = path.join(root, safe);
    if (!filePath.startsWith(root)) continue;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(filePath, res);
      return true;
    }
  }
  return false;
}

/**
 * Serve the SPA shell (index.html) with optional per-route meta injection
 * and X-Robots-Tag: noindex for auth-gated paths.
 */
function serveWebSpa(pathname, res) {
  const indexPath = path.join(WEB_ROOT, "index.html");
  if (!fs.existsSync(indexPath)) return false;

  let html = fs.readFileSync(indexPath, "utf-8");
  html = buildHtmlForRoute(html, pathname);

  const headers = { "content-type": "text/html; charset=utf-8" };
  if (isNoindexRoute(pathname)) {
    headers["x-robots-tag"] = "noindex, nofollow";
  }

  res.writeHead(200, headers);
  res.end(html);
  return true;
}

function proxyApi(req, res, apiPath) {
  const target = new URL(apiPath, API_UPSTREAM);
  const options = {
    hostname: target.hostname,
    port: 443,
    path: target.pathname + target.search,
    method: req.method,
    headers: { ...req.headers, host: target.hostname },
  };
  const proxy = https.request(options, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });
  proxy.on("error", (err) => {
    console.error("API proxy error:", err.message);
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad Gateway");
  });
  req.pipe(proxy);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  // Proxy all /api/* requests to the upstream API server.
  if (pathname.startsWith("/api")) {
    return proxyApi(req, res, pathname + url.search);
  }

  const platform = req.headers["expo-platform"];
  const isExpoClient = platform === "ios" || platform === "android";

  // Native Expo Go clients: serve manifest at / and /manifest.
  if (isExpoClient && (pathname === "/" || pathname === "/manifest")) {
    return serveManifest(platform, res);
  }

  // Browser hitting "/" → web SPA index.
  if (pathname === "/" || pathname === "") {
    if (serveWebSpa("/", res)) return;
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Web build not found. Run `pnpm --filter @workspace/copointo run build`.");
  }

  // Static files: try web build first, then the legacy expo asset roots.
  if (tryServeFrom([WEB_ROOT, STATIC_ROOT], pathname, res)) return;

  // SPA fallback: only serve the app shell for known Expo Router paths.
  // Unknown paths get a real HTTP 404 instead of a silent 200 soft-404.
  if (!isExpoClient) {
    if (isKnownRoute(pathname)) {
      if (serveWebSpa(pathname, res)) return;
    }
    // Truly unknown path — return a proper 404.
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    return res.end(NOT_FOUND_HTML);
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving Expo build on port ${port} (web SPA + native manifests)`);
});
