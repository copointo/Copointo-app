import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import cafeDashRouter from "./cafe-dashboard";
import { cafes, users, freeCoffees, reels, reelLikes, reelComments, reelViews, broadcasts } from "../store";
import { geocodeAddress } from "../utils/geocode";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/cafe/:cafeId", cafeDashRouter);

// Public cafes endpoint for mobile app
router.get("/cafes", async (_req, res) => {
  const active = cafes.filter(c => c.active);

  // Lazy backfill: geocode any active cafe missing coordinates (in parallel, capped)
  const missing = active.filter(c => (c.lat == null || c.lng == null) && c.address);
  if (missing.length) {
    await Promise.all(missing.slice(0, 10).map(async c => {
      const geo = await geocodeAddress(c.address);
      if (geo) { c.lat = geo.lat; c.lng = geo.lng; }
    }));
  }

  const publicCafes = active.map(c => ({
    id: c.id, name: c.name, logo: c.logo, image: c.image,
    openTime: c.openTime, closeTime: c.closeTime,
    rating: c.rating, tags: c.tags, address: c.address,
    lat: c.lat, lng: c.lng,
  }));
  res.json({ cafes: publicCafes });
});

// Public single-cafe endpoint
router.get("/cafes/:id", (req, res) => {
  const c = cafes.find(x => x.id === req.params.id);
  if (!c) { res.status(404).json({ error: "Cafe not found" }); return; }
  res.json({
    cafe: {
      id: c.id, name: c.name, logo: c.logo, image: c.image,
      openTime: c.openTime, closeTime: c.closeTime,
      rating: c.rating, tags: c.tags, address: c.address,
      active: c.active,
      lat: c.lat, lng: c.lng,
    }
  });
});

// Public game-status endpoint — used by the mobile app to check whether
// the current user is suspended or banned from the game.
// Lookup by phone (mobile keeps user state local; phone is the bridge).
router.get("/user-status", (req, res) => {
  const phone = String(req.query.phone ?? "").trim();
  if (!phone) { res.json({ gameBanned: false, gameSuspended: false }); return; }
  const u = users.find(x => x.phone === phone);
  if (!u) { res.json({ gameBanned: false, gameSuspended: false }); return; }
  const now = Date.now();
  const until = u.gameSuspendedUntil ? new Date(u.gameSuspendedUntil).getTime() : 0;
  const isSuspended = !!u.gameSuspendedUntil && until > now;
  res.json({
    gameBanned:        !!u.gameBanned,
    gameSuspended:     isSuspended,
    gameSuspendedUntil: isSuspended ? u.gameSuspendedUntil : null,
    gameSuspendReason:  (u.gameBanned || isSuspended) ? (u.gameSuspendReason ?? null) : null,
    gameSuspendedAt:    (u.gameBanned || isSuspended) ? (u.gameSuspendedAt ?? null) : null,
  });
});

// Public — list free coffees a user has earned (mobile notifications screen).
router.get("/free-coffees", (req, res) => {
  const phone = String(req.query.phone ?? "").trim();
  if (!phone) { res.json({ coffees: [] }); return; }
  const list = freeCoffees
    .filter(f => f.userPhone === phone)
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
  res.json({ coffees: list });
});

// ─── Public Broadcasts endpoint ─────────────────────────────────────────
// Mobile fetches system broadcasts (announcements from Copointo super-admin).
// Optional ?since=<ISO> filters to only newer broadcasts.
router.get("/broadcasts", (req, res) => {
  const since = String(req.query.since ?? "").trim();
  const items = since
    ? broadcasts.filter(b => b.createdAt > since)
    : broadcasts;
  res.json({ broadcasts: items });
});

// ─── Public Reels endpoints ─────────────────────────────────────────────
// Engagement-ranked feed: score = likes*3 + comments*5 + views*0.05, with a
// recency boost so brand-new reels still surface.
router.get("/reels", (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  const now = Date.now();
  const enriched = reels.map(r => {
    const likes    = reelLikes.filter(l => l.reelId === r.id).length;
    const comments = reelComments.filter(c => c.reelId === r.id).length;
    const ageHours = Math.max(1, (now - new Date(r.createdAt).getTime()) / 3_600_000);
    const recencyBoost = 30 / Math.sqrt(ageHours);
    const score = likes * 3 + comments * 5 + r.views * 0.05 + recencyBoost;
    const likedByMe = userId
      ? reelLikes.some(l => l.reelId === r.id && l.userId === userId)
      : false;
    // Replace the heavy data:// URL with a streaming endpoint so <video> can
    // start playback before the full payload is buffered (avoids black screen
    // for large/long reels).
    const videoUrl = `/api/reels/${r.id}/video`;
    return { ...r, videoUrl, likes, comments, likedByMe, score };
  });
  enriched.sort((a, b) => b.score - a.score);
  res.json({ reels: enriched.map(({ score: _s, ...rest }) => rest) });
});

// Stream a reel's video binary with proper Content-Type and Range support so
// the browser/native player can seek and start playback immediately.
router.get("/reels/:rid/video", (req, res): any => {
  const r = reels.find(x => x.id === req.params.rid);
  if (!r || !r.videoUrl) return res.status(404).end();
  // Accept data URLs with optional codec parameters, e.g.
  // "data:video/webm;codecs=vp9;base64,...". The mime portion is everything
  // up to ";base64,".
  const m = /^data:([^,]+?);base64,(.*)$/s.exec(r.videoUrl);
  if (!m) return res.status(415).end();
  // Strip codec parameters for the response Content-Type — most browsers
  // handle the bare type more reliably for <video> playback.
  const mime = m[1].split(";")[0].trim() || "video/mp4";
  const buf = Buffer.from(m[2], "base64");
  const total = buf.length;
  res.setHeader("Content-Type", mime);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=3600");
  const range = req.headers.range;
  if (range) {
    const parts = /bytes=(\d*)-(\d*)/.exec(String(range));
    if (parts) {
      const start = parts[1] ? parseInt(parts[1], 10) : 0;
      const end   = parts[2] ? parseInt(parts[2], 10) : total - 1;
      if (start >= total || end >= total) {
        res.status(416).setHeader("Content-Range", `bytes */${total}`);
        return res.end();
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", String(end - start + 1));
      return res.end(buf.subarray(start, end + 1));
    }
  }
  res.setHeader("Content-Length", String(total));
  res.end(buf);
});

router.post("/reels/:rid/like", (req, res): any => {
  const reel = reels.find(r => r.id === req.params.rid);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const userId   = String(req.body?.userId   ?? "").trim();
  const userName = String(req.body?.userName ?? "").trim() || "مستخدم";
  if (!userId) return res.status(400).json({ error: "userId required" });
  const existingIdx = reelLikes.findIndex(l => l.reelId === reel.id && l.userId === userId);
  let liked: boolean;
  if (existingIdx === -1) {
    reelLikes.push({ reelId: reel.id, userId, userName, likedAt: new Date().toISOString() });
    liked = true;
  } else {
    reelLikes.splice(existingIdx, 1);
    liked = false;
  }
  const likes = reelLikes.filter(l => l.reelId === reel.id).length;
  res.json({ liked, likes });
});

router.get("/reels/:rid/comments", (req, res): any => {
  const reel = reels.find(r => r.id === req.params.rid);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const list = reelComments
    .filter(c => c.reelId === reel.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ comments: list });
});

router.post("/reels/:rid/comments", (req, res): any => {
  const reel = reels.find(r => r.id === req.params.rid);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const userId   = String(req.body?.userId   ?? "").trim();
  const userName = String(req.body?.userName ?? "").trim() || "مستخدم";
  const text     = String(req.body?.text     ?? "").trim();
  if (!userId) return res.status(400).json({ error: "userId required" });
  if (!text)   return res.status(400).json({ error: "text required" });
  const c = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    reelId: reel.id,
    userId, userName, text,
    createdAt: new Date().toISOString(),
  };
  reelComments.push(c);
  res.status(201).json({ comment: c });
});

router.post("/reels/:rid/view", (req, res): any => {
  const reel = reels.find(r => r.id === req.params.rid);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const userId = String(req.body?.userId ?? "").trim();
  if (userId) {
    const already = reelViews.some(v => v.reelId === reel.id && v.userId === userId);
    if (already) { res.json({ views: reel.views }); return; }
    reelViews.push({ reelId: reel.id, userId, viewedAt: new Date().toISOString() });
  }
  reel.views += 1;
  res.json({ views: reel.views });
});

export default router;
