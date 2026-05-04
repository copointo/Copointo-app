import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import cafeDashRouter from "./cafe-dashboard";
import {
  cafes, users, freeCoffees, reels, reelLikes, reelComments, reelViews, broadcasts,
  bookings,
  usernameRegistry, cafeRatings, getCafeRatingStats,
  persistStore, type AppUser,
} from "../store";
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

  const publicCafes = active.map(c => {
    const stats = getCafeRatingStats(c.id);
    return {
      id: c.id, name: c.name, logo: c.logo, image: c.image,
      openTime: c.openTime, closeTime: c.closeTime,
      // `rating` is now the LIVE average from user ratings (0 if none).
      rating: stats.rating,
      ratingCount: stats.ratingCount,
      tags: c.tags, address: c.address,
      lat: c.lat, lng: c.lng,
    };
  });
  // Sort by rating desc so the top-rated café appears first; cafes with no
  // ratings (rating=0) drop to the bottom. Stable secondary sort: more
  // ratings first, then most recently created.
  publicCafes.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    return 0;
  });
  res.json({ cafes: publicCafes });
});

// Public single-cafe endpoint
router.get("/cafes/:id", (req, res) => {
  const c = cafes.find(x => x.id === req.params.id);
  if (!c) { res.status(404).json({ error: "Cafe not found" }); return; }
  const stats = getCafeRatingStats(c.id);
  res.json({
    cafe: {
      id: c.id, name: c.name, logo: c.logo, image: c.image,
      openTime: c.openTime, closeTime: c.closeTime,
      rating: stats.rating,
      ratingCount: stats.ratingCount,
      tags: c.tags, address: c.address,
      active: c.active,
      lat: c.lat, lng: c.lng,
    }
  });
});

// ─── Cafe rating endpoints ─────────────────────────────────────────────
// Get the current user's rating for a cafe (0 if not yet rated).
router.get("/cafes/:id/my-rating", (req, res): any => {
  const cafeId = req.params.id;
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) return res.json({ stars: 0 });
  const entry = cafeRatings.find(r => r.cafeId === cafeId && r.userId === userId);
  return res.json({ stars: entry?.stars ?? 0 });
});

// Upsert a rating (1-5 stars) for the given cafe + user. Submitting again
// replaces the previous rating so each user contributes exactly one entry.
router.post("/cafes/:id/rate", (req, res): any => {
  const cafeId = req.params.id;
  const cafe = cafes.find(c => c.id === cafeId);
  if (!cafe) return res.status(404).json({ ok: false, error: "الكوفي غير موجود" });
  const userId = String(req.body?.userId ?? "").trim();
  const stars  = Number(req.body?.stars);
  if (!userId) return res.status(400).json({ ok: false, error: "userId مطلوب" });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ ok: false, error: "التقييم يجب أن يكون بين 1 و 5 نجوم" });
  }
  const idx = cafeRatings.findIndex(r => r.cafeId === cafeId && r.userId === userId);
  const now = new Date().toISOString();
  if (idx >= 0) {
    cafeRatings[idx].stars   = stars;
    cafeRatings[idx].ratedAt = now;
  } else {
    cafeRatings.push({ cafeId, userId, stars, ratedAt: now });
  }
  persistStore();
  const stats = getCafeRatingStats(cafeId);
  return res.json({ ok: true, stars, ...stats });
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

// Public — list a customer's table bookings (mobile notifications screen)
// so they see a confirmation message once the cafe approves their request.
router.get("/bookings", (req, res) => {
  const phone = String(req.query.phone ?? "").trim();
  if (!phone) { res.json({ bookings: [] }); return; }
  const list = bookings
    .filter(b => b.customerPhone === phone)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ bookings: list });
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
  // "data:video/webm;codecs=vp9,opus;base64,..." (codec list itself contains
  // commas, so we anchor on the literal ";base64," separator instead).
  const idx = r.videoUrl.indexOf(";base64,");
  const m = idx > 5 && r.videoUrl.startsWith("data:")
    ? [r.videoUrl, r.videoUrl.slice(5, idx), r.videoUrl.slice(idx + 8)] as const
    : null;
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

router.delete("/reels/:rid/comments/:cid", (req, res): any => {
  const reel = reels.find(r => r.id === req.params.rid);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const idx = reelComments.findIndex(c => c.id === req.params.cid && c.reelId === reel.id);
  if (idx === -1) return res.status(404).json({ error: "Comment not found" });
  reelComments.splice(idx, 1);
  res.json({ ok: true });
});

// ─── Game username uniqueness ────────────────────────────────────────────
// Mobile users keep their account locally per-device, so device-local checks
// cannot guarantee that a `gameUsername` is unique across the whole country.
// These two endpoints are the single source of truth: claim reserves a
// username for a user (replacing any prior claim by that user), and check
// returns availability without mutating state.
function normalizeUsername(raw: unknown): string {
  return String(raw ?? "").trim();
}

router.get("/usernames/check", (req, res): any => {
  const username = normalizeUsername(req.query.username);
  const userId   = String(req.query.userId ?? "").trim();
  if (!username) return res.json({ available: false, reason: "اكتب يوزر اللعبة" });
  const key = username.toLowerCase();
  const taken = usernameRegistry.find(u => u.username === key);
  const available = !taken || taken.userId === userId;
  res.json({ available, reason: available ? null : "يوزر اللعبة مستخدم مسبقاً" });
});

router.post("/usernames/claim", (req, res): any => {
  const username = normalizeUsername(req.body?.username);
  const userId   = String(req.body?.userId ?? "").trim();
  if (!userId)   return res.status(400).json({ ok: false, error: "userId required" });
  if (!username) return res.status(400).json({ ok: false, error: "يوزر اللعبة مطلوب" });
  if (username.length < 3 || username.length > 24) {
    return res.status(400).json({ ok: false, error: "يوزر اللعبة يجب أن يكون بين 3 و 24 حرفاً" });
  }
  const key = username.toLowerCase();
  const existing = usernameRegistry.find(u => u.username === key);
  if (existing && existing.userId !== userId) {
    return res.status(409).json({ ok: false, error: "يوزر اللعبة مستخدم مسبقاً" });
  }
  // Replace any prior claim by this same user (allow renaming).
  for (let i = usernameRegistry.length - 1; i >= 0; i--) {
    if (usernameRegistry[i].userId === userId) usernameRegistry.splice(i, 1);
  }
  usernameRegistry.push({
    username: key,
    display: username,
    userId,
    claimedAt: new Date().toISOString(),
  });
  // Keep the matching AppUser record in sync so the super-admin shows the
  // current display name immediately after a rename.
  const existingUser = users.find(u => u.id === userId);
  if (existingUser) existingUser.username = username;
  persistStore();
  res.json({ ok: true, username });
});

// ─── Mobile user registration (super-admin visibility) ───────────────────
// The mobile app keeps its account state in AsyncStorage (per device), but
// the super admin needs to see every user that registered on the platform.
// `register` upserts a user into the server's `users` collection so the
// admin "Users" page lists real, signed-up players — not only those who
// placed an order.
router.post("/users/register", (req, res): any => {
  const id        = String(req.body?.id ?? "").trim();
  const username  = normalizeUsername(req.body?.username);
  const phone     = String(req.body?.phone ?? "").trim();
  const joinedAt  = String(req.body?.joinedAt ?? "").trim() || new Date().toISOString();
  if (!id)       return res.status(400).json({ ok: false, error: "id required" });
  if (!username) return res.status(400).json({ ok: false, error: "يوزر اللعبة مطلوب" });
  if (!phone)    return res.status(400).json({ ok: false, error: "رقم الهاتف مطلوب" });
  if (username.length < 3 || username.length > 24) {
    return res.status(400).json({ ok: false, error: "يوزر اللعبة يجب أن يكون بين 3 و 24 حرفاً" });
  }
  // ATOMIC: validate BOTH constraints before mutating either collection so a
  // failure cannot leave an orphaned username claim or an orphaned user row.
  const usernameKey = username.toLowerCase();
  const usernameClash = usernameRegistry.find(u => u.username === usernameKey && u.userId !== id);
  if (usernameClash) return res.status(409).json({ ok: false, error: "يوزر اللعبة مستخدم مسبقاً" });
  const phoneClash = users.find(u => u.phone === phone && u.id !== id);
  if (phoneClash)    return res.status(409).json({ ok: false, error: "رقم الهاتف مسجّل مسبقاً" });

  // Both checks passed — commit username claim and user row together.
  for (let i = usernameRegistry.length - 1; i >= 0; i--) {
    if (usernameRegistry[i].userId === id) usernameRegistry.splice(i, 1);
  }
  usernameRegistry.push({
    username: usernameKey, display: username, userId: id,
    claimedAt: new Date().toISOString(),
  });

  const existing = users.find(u => u.id === id);
  if (existing) {
    // Idempotent: refresh username/phone but preserve game state, ban flags,
    // totalOrders earned through real orders, etc.
    existing.username = username;
    existing.phone    = phone;
    persistStore();
    return res.json({ ok: true, user: existing });
  }
  const u: AppUser = {
    id, username, phone,
    level: 0,
    totalOrders: 0,
    banned: false,
    joinedAt,
  };
  users.push(u);
  persistStore();
  res.json({ ok: true, user: u });
});

// ─── Public users list (mobile leaderboard) ──────────────────────────────
// Every mobile device should see EVERY registered player on the platform —
// not just the accounts created on its own AsyncStorage. The leaderboard
// hits this endpoint to merge the global roster with whatever local profile
// data it already has. Banned / game-banned players are filtered out so
// they don't appear in any ranking.
router.get("/users/public", (_req, res) => {
  res.json({
    users: users
      .filter(u => !u.banned && !u.gameBanned)
      .map(u => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        level: u.level ?? 0,
        totalOrders: u.totalOrders ?? 0,
        joinedAt: u.joinedAt,
      })),
  });
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
