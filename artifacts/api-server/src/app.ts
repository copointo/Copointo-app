import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { ensureLoaded, refreshFromDb } from "./store";

const app: Express = express();

// Disable ETag globally so data API responses never get a 304 (which would
// make the browser serve a stale cached body — e.g. the menu list missing
// items the user just added). Static assets are served by Vite/CDN, not
// this server, so disabling ETag here only affects JSON API responses.
app.set("etag", false);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "300mb" }));
app.use(express.urlencoded({ extended: true, limit: "60mb" }));

// Make sure the in-memory cache mirrors the latest DB state before any
// handler reads it. On autoscale deployments multiple instances share the
// same DB but have independent caches, so we re-sync on every request.
app.use("/api", async (_req, res, next) => {
  // Belt-and-suspenders: tell the browser to never cache JSON API data.
  // Combined with `etag: false` above, this guarantees a freshly-added
  // menu item (or any mutation) is visible on the very next GET.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    await ensureLoaded();
    await refreshFromDb();
  } catch {
    // Refresh failures are logged inside store.ts; never block requests.
  }
  next();
});

app.use("/api", router);

export default app;
