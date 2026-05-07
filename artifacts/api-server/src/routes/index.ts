import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import healthRouter from "./health";
import adminRouter from "./admin";
import cafeDashRouter from "./cafe-dashboard";

const REELS_DIR = path.join(process.cwd(), "uploads", "reels");
const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime",
  ".webm": "video/webm", ".mkv": "video/x-matroska", ".ogv": "video/ogg",
};
import {
  cafes, users, freeCoffees, reels, reelLikes, reelComments, reelViews, broadcasts,
  bookings, orders,
  usernameRegistry, cafeRatings, getCafeRatingStats,
  friendRequests, addFriendship, removeFriendship, friendsOf, areFriends,
  chatMessages, friendScope,
  persistStore, type AppUser, type FriendRequest, type ChatMsg,
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

// Public — list a customer's past orders across all cafes (mobile cafe-history
// screen). Joins each order with its cafe name so the mobile UI can render it
// without an extra round trip. Optional `cafeId` query filters to a single
// café. Mobile keeps a 30-day window client-side.
router.get("/orders", (req, res) => {
  const phone  = String(req.query.phone ?? "").trim();
  const cafeId = String(req.query.cafeId ?? "").trim();
  if (!phone) { res.json({ orders: [] }); return; }
  const cafeNameById = new Map(cafes.map(c => [c.id, c.name]));
  const list = orders
    .filter(o => o.customerPhone === phone)
    .filter(o => !cafeId || o.cafeId === cafeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(o => ({ ...o, cafeName: cafeNameById.get(o.cafeId) ?? "" }));
  res.json({ orders: list });
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

  // Mode A: on-disk file ("file:<filename>") — preferred, used by all new
  // uploads. Stream from disk with HTTP Range support.
  if (r.videoUrl.startsWith("file:")) {
    const filename = r.videoUrl.slice(5);
    // Defence-in-depth: prevent path traversal via crafted filenames.
    const safe = path.basename(filename);
    const filePath = path.join(REELS_DIR, safe);
    let stat: fs.Stats;
    try { stat = fs.statSync(filePath); }
    catch { return res.status(404).end(); }
    const total = stat.size;
    const ext = path.extname(safe).toLowerCase();
    const mime = MIME_BY_EXT[ext] || "video/mp4";
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
        return fs.createReadStream(filePath, { start, end }).pipe(res);
      }
    }
    res.setHeader("Content-Length", String(total));
    return fs.createReadStream(filePath).pipe(res);
  }

  // Mode B (legacy): inline data URL kept for backward compatibility with
  // reels created before the disk-storage migration.
  const idx = r.videoUrl.indexOf(";base64,");
  const m = idx > 5 && r.videoUrl.startsWith("data:")
    ? [r.videoUrl, r.videoUrl.slice(5, idx), r.videoUrl.slice(idx + 8)] as const
    : null;
  if (!m) return res.status(415).end();
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

// ─── Game progress sync (level + totalOrders) ────────────────────────────
// The mobile client increments per-cafe progress locally on `addCafeOrder`,
// then mirrors the new global level + totalOrders here so OTHER devices see
// the bump on the leaderboard within their next refresh. We only ever
// INCREASE the stored values (never roll back) so a stale device that
// reconnects can't undo real progress earned on another device.
router.post("/users/progress", (req, res): any => {
  const id          = String(req.body?.id ?? "").trim();
  const level       = Number(req.body?.level ?? 0);
  const totalOrders = Number(req.body?.totalOrders ?? 0);
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  const u = users.find(x => x.id === id);
  if (!u) return res.status(404).json({ ok: false, error: "user not found" });
  let changed = false;
  if (Number.isFinite(level) && level > (u.level ?? 0)) {
    u.level = Math.min(999, Math.floor(level));
    changed = true;
  }
  if (Number.isFinite(totalOrders) && totalOrders > (u.totalOrders ?? 0)) {
    u.totalOrders = Math.floor(totalOrders);
    changed = true;
  }
  if (changed) persistStore();
  res.json({ ok: true, user: { id: u.id, level: u.level, totalOrders: u.totalOrders } });
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

// ─── Friend requests + friendships ──────────────────────────────────────
// Cross-device friend system. The mobile client polls these endpoints to
// see incoming requests, friendships, and decline receipts (so a sender
// gets notified once the other user rejects their request).

/** Get full friend snapshot for a user. */
router.get("/friends", (req, res): any => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) return res.status(400).json({ error: "userId required" });
  const incoming = friendRequests
    .filter(r => r.toUserId === userId && r.status === "pending")
    .map(r => ({ id: r.id, fromUserId: r.fromUserId, createdAt: r.createdAt }));
  const outgoingPending = friendRequests
    .filter(r => r.fromUserId === userId && r.status === "pending")
    .map(r => ({ id: r.id, toUserId: r.toUserId, createdAt: r.createdAt }));
  // Decline receipts the sender has not yet seen — show once, then ack.
  const rejections = friendRequests
    .filter(r => r.fromUserId === userId && r.status === "declined")
    .map(r => ({ id: r.id, toUserId: r.toUserId, decidedAt: r.decidedAt }));
  res.json({
    friends: friendsOf(userId),
    incoming,
    outgoing: outgoingPending,
    rejections,
  });
});

/** Send a friend request (or auto-accept if the other user already sent one). */
router.post("/friend-requests", (req, res): any => {
  const fromUserId = String(req.body?.fromUserId ?? "").trim();
  const toUserId   = String(req.body?.toUserId   ?? "").trim();
  if (!fromUserId || !toUserId) return res.status(400).json({ error: "fromUserId/toUserId required" });
  if (fromUserId === toUserId)  return res.status(400).json({ error: "self request" });
  if (areFriends(fromUserId, toUserId)) return res.json({ ok: true, alreadyFriends: true });

  // If the other user already requested me, treat this as accept.
  const reverse = friendRequests.find(
    r => r.fromUserId === toUserId && r.toUserId === fromUserId && r.status === "pending",
  );
  if (reverse) {
    addFriendship(fromUserId, toUserId);
    // Drop the reverse pending row — they're now friends.
    const idx = friendRequests.indexOf(reverse);
    if (idx !== -1) friendRequests.splice(idx, 1);
    persistStore();
    return res.json({ ok: true, accepted: true });
  }

  // Already have an outgoing pending? no-op.
  const existing = friendRequests.find(
    r => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === "pending",
  );
  if (existing) return res.json({ ok: true, request: existing });

  // Drop any stale declined receipt for this same pair (sender resending).
  for (let i = friendRequests.length - 1; i >= 0; i--) {
    const r = friendRequests[i]!;
    if (r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === "declined") {
      friendRequests.splice(i, 1);
    }
  }

  const fr: FriendRequest = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    fromUserId, toUserId, status: "pending",
    createdAt: new Date().toISOString(),
  };
  friendRequests.push(fr);
  persistStore();
  res.status(201).json({ ok: true, request: fr });
});

/** Accept a pending request — only the recipient may accept. */
router.post("/friend-requests/:id/accept", (req, res): any => {
  const userId = String(req.body?.userId ?? "").trim();
  const fr = friendRequests.find(r => r.id === req.params.id);
  if (!fr) return res.status(404).json({ error: "request not found" });
  if (fr.toUserId !== userId) return res.status(403).json({ error: "not the recipient" });
  if (fr.status !== "pending") return res.status(400).json({ error: "already decided" });
  addFriendship(fr.fromUserId, fr.toUserId);
  // Accepted requests are removed entirely (no receipt needed — the sender
  // sees the new friendship in their friends list).
  const idx = friendRequests.indexOf(fr);
  if (idx !== -1) friendRequests.splice(idx, 1);
  persistStore();
  res.json({ ok: true });
});

/** Decline a pending request — keeps a receipt so the sender gets notified. */
router.post("/friend-requests/:id/decline", (req, res): any => {
  const userId = String(req.body?.userId ?? "").trim();
  const fr = friendRequests.find(r => r.id === req.params.id);
  if (!fr) return res.status(404).json({ error: "request not found" });
  if (fr.toUserId !== userId) return res.status(403).json({ error: "not the recipient" });
  if (fr.status !== "pending") return res.status(400).json({ error: "already decided" });
  fr.status = "declined";
  fr.decidedAt = new Date().toISOString();
  persistStore();
  res.json({ ok: true });
});

/** Sender acknowledges a "your request was declined" receipt — removes it. */
router.post("/friend-requests/:id/ack", (req, res): any => {
  const userId = String(req.body?.userId ?? "").trim();
  const fr = friendRequests.find(r => r.id === req.params.id);
  if (!fr) return res.json({ ok: true });
  if (fr.fromUserId !== userId) return res.status(403).json({ error: "not the sender" });
  const idx = friendRequests.indexOf(fr);
  if (idx !== -1) friendRequests.splice(idx, 1);
  persistStore();
  res.json({ ok: true });
});

/** Cancel an outgoing pending request (sender deletes it before decision). */
router.delete("/friend-requests/:id", (req, res): any => {
  const userId = String(req.query.userId ?? req.body?.userId ?? "").trim();
  const fr = friendRequests.find(r => r.id === req.params.id);
  if (!fr) return res.json({ ok: true });
  if (fr.fromUserId !== userId) return res.status(403).json({ error: "not the sender" });
  if (fr.status !== "pending") return res.status(400).json({ error: "already decided" });
  const idx = friendRequests.indexOf(fr);
  if (idx !== -1) friendRequests.splice(idx, 1);
  persistStore();
  res.json({ ok: true });
});

/** Unfriend — either side may remove the friendship. */
router.delete("/friendships", (req, res): any => {
  const userId  = String(req.query.userId  ?? req.body?.userId  ?? "").trim();
  const otherId = String(req.query.otherId ?? req.body?.otherId ?? "").trim();
  if (!userId || !otherId) return res.status(400).json({ error: "userId/otherId required" });
  removeFriendship(userId, otherId);
  // Also clear any lingering pending requests between them.
  for (let i = friendRequests.length - 1; i >= 0; i--) {
    const r = friendRequests[i]!;
    if ((r.fromUserId === userId && r.toUserId === otherId) ||
        (r.fromUserId === otherId && r.toUserId === userId)) {
      friendRequests.splice(i, 1);
    }
  }
  persistStore();
  res.json({ ok: true });
});

// ─── Cross-device chat messages ──────────────────────────────────────────
// Real WhatsApp-style messaging: clients POST every outgoing message here
// and poll GET /messages to pick up incoming ones from other devices. The
// server is the single source of truth so a message sent from device A
// appears on device B within the next poll cycle.

/** Send a new message. Idempotent on `id` so retries are safe. */
router.post("/messages", (req, res): any => {
  const id          = String(req.body?.id ?? "").trim();
  const senderId    = String(req.body?.senderId ?? "").trim();
  const kind        = req.body?.kind === "group" ? "group" : "friend";
  const text        = String(req.body?.text ?? "").trim();
  const recipientId = String(req.body?.recipientId ?? "").trim();
  const groupId     = String(req.body?.groupId ?? "").trim();
  if (!id || !senderId || !text) {
    return res.status(400).json({ error: "id/senderId/text required" });
  }
  // Dedupe — if this id already exists, just return the stored row.
  const existing = chatMessages.find(m => m.id === id);
  if (existing) return res.json({ ok: true, message: existing });

  let scope: string;
  if (kind === "friend") {
    if (!recipientId) return res.status(400).json({ error: "recipientId required" });
    scope = friendScope(senderId, recipientId);
  } else {
    if (!groupId) return res.status(400).json({ error: "groupId required" });
    scope = groupId;
  }
  const msg: ChatMsg = {
    id, kind, scope, senderId, text,
    createdAt: new Date().toISOString(),
    seenBy: [senderId],   // sender has implicitly "seen" their own message
  };
  chatMessages.push(msg);
  persistStore();
  res.status(201).json({ ok: true, message: msg });
});

/**
 * Pull all messages visible to a user (both sides of every friend chat
 * the user is in, plus every group the user names in `groupIds`). Returns
 * a flat list sorted oldest → newest. The client merges by id and updates
 * its UI; passing `since=<ISO>` filters to messages newer than that to keep
 * payloads small. Even with `since` we always include unseen-by-me sender
 * messages so ✓✓ updates propagate back to the original sender.
 */
router.get("/messages", (req, res): any => {
  const userId   = String(req.query.userId ?? "").trim();
  const groupIds = String(req.query.groupIds ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const since    = String(req.query.since ?? "").trim();
  if (!userId) return res.status(400).json({ error: "userId required" });
  const groupSet = new Set(groupIds);

  const visible = chatMessages.filter(m => {
    if (m.kind === "friend") {
      const [a, b] = m.scope.split("|");
      return a === userId || b === userId;
    }
    return groupSet.has(m.scope);
  });

  const filtered = since
    ? visible.filter(m => m.createdAt > since || (m.senderId === userId && m.seenBy.length > 1))
    : visible;

  filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ messages: filtered, now: new Date().toISOString() });
});

/**
 * Mark every message in a conversation scope as seen by `userId`. The
 * recipient calls this when they open the chat — the sender will see ✓✓
 * after their next poll picks up the updated `seenBy` list.
 */
router.post("/messages/seen", (req, res): any => {
  const userId = String(req.body?.userId ?? "").trim();
  const kind   = req.body?.kind === "group" ? "group" : "friend";
  const otherId = String(req.body?.otherId ?? "").trim();   // for friend scope
  const groupId = String(req.body?.groupId ?? "").trim();   // for group scope
  if (!userId) return res.status(400).json({ error: "userId required" });

  let scope: string;
  if (kind === "friend") {
    if (!otherId) return res.status(400).json({ error: "otherId required" });
    scope = friendScope(userId, otherId);
  } else {
    if (!groupId) return res.status(400).json({ error: "groupId required" });
    scope = groupId;
  }
  let changed = 0;
  for (const m of chatMessages) {
    if (m.scope === scope && !m.seenBy.includes(userId)) {
      m.seenBy.push(userId);
      changed++;
    }
  }
  if (changed > 0) persistStore();
  res.json({ ok: true, updated: changed });
});

export default router;
