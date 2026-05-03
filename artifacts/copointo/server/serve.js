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
const fs = require("fs");
const path = require("path");

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
};

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

function serveWebSpa(res) {
  const indexPath = path.join(WEB_ROOT, "index.html");
  if (fs.existsSync(indexPath)) {
    sendFile(indexPath, res);
    return true;
  }
  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  const platform = req.headers["expo-platform"];
  const isExpoClient = platform === "ios" || platform === "android";

  // Native Expo Go clients: serve manifest at / and /manifest.
  if (isExpoClient && (pathname === "/" || pathname === "/manifest")) {
    return serveManifest(platform, res);
  }

  // Browser hitting "/" → web SPA index.
  if (pathname === "/" || pathname === "") {
    if (serveWebSpa(res)) return;
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Web build not found. Run `pnpm --filter @workspace/copointo run build`.");
  }

  // Static files: try web build first, then the legacy expo asset roots.
  if (tryServeFrom([WEB_ROOT, STATIC_ROOT], pathname, res)) return;

  // SPA fallback: unknown route from a browser → serve the web index so the
  // expo-router client can handle the path.
  if (!isExpoClient && serveWebSpa(res)) return;

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving Expo build on port ${port} (web SPA + native manifests)`);
});
