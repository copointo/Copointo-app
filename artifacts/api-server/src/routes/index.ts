import { Router, type IRouter } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { reelFile, uploadChatMediaFile, chatMediaFile } from "../lib/objectStorage";
import healthRouter from "./health";
import adminRouter from "./admin";
import cafeDashRouter from "./cafe-dashboard";
import authOtpRouter, { consumeOtpToken } from "./auth-otp";
import paymentsRouter from "./payments";
import { isShowcaseViewer } from "../showcase-seed";

const REELS_DIR = path.join(process.cwd(), "uploads", "reels");
const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime",
  ".webm": "video/webm", ".mkv": "video/x-matroska", ".ogv": "video/ogg",
};
import {
  cafes, users, freeCoffees, reels, reelLikes, reelComments, reelViews, broadcasts, coinGifts,
  progressAdjustments,
  bookings, orders, pushTokens,
  usernameRegistry, cafeRatings, getCafeRatingStats,
  friendRequests, addFriendship, removeFriendship, friendsOf, areFriends,
  chatMessages, friendScope,
  reports,
  communities, communityInvites,
  type Community, type CommunityInvite, type CommunityRole, type PushToken,
  purgeUserData,
  persistStore,
  flushNow,
  type AppUser, type FriendRequest, type ChatMsg, type Broadcast, type Report, type CoinGift,
} from "../store";
import { geocodeAddress } from "../utils/geocode";
import { sendPushToUser, sendPushToAll } from "../lib/push";
import { getVapidPublicKey } from "../lib/webPush";
import { webPushSubscriptions } from "../store";
import {
  MONTHLY_REWARDS, checkAndProcessSeasonEnd, rankPlayersForSeason,
} from "../lib/monthlySeason";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/cafe/:cafeId", cafeDashRouter);
router.use("/auth/otp", authOtpRouter);
router.use("/payments", paymentsRouter);

// Public cafes endpoint for mobile app
router.get("/cafes", async (req, res) => {

  const viewer = isShowcaseViewer(String(req.query.userId ?? ""));
  const active = cafes.filter(c => c.active && (viewer || !c.showcaseOnly));

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
router.get("/cafes/:id", async (req, res) => {

  const viewer = isShowcaseViewer(String(req.query.userId ?? ""));
  const c = cafes.find(x => x.id === req.params.id);
  if (!c || (c.showcaseOnly && !viewer)) { res.status(404).json({ error: "Cafe not found" }); return; }
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
  const cafe = cafes.find(c => c.id === cafeId);
  if (!cafe || (cafe.showcaseOnly && !isShowcaseViewer(userId))) {
    return res.status(404).json({ error: "Cafe not found" });
  }
  if (!userId) return res.json({ stars: 0, comment: "" });
  const entry = cafeRatings.find(r => r.cafeId === cafeId && r.userId === userId);
  return res.json({ stars: entry?.stars ?? 0, comment: entry?.comment ?? "" });
});

// List every rating left for a cafe (newest first), with the rater's name,
// avatar, stars and optional comment — used by the "عرض التقييمات" panel.
router.get("/cafes/:id/ratings", (req, res): any => {
  const cafeId = req.params.id;
  const cafe = cafes.find(c => c.id === cafeId);
  if (!cafe || (cafe.showcaseOnly && !isShowcaseViewer(String(req.query.userId ?? "")))) {
    return res.status(404).json({ error: "Cafe not found" });
  }
  const list = cafeRatings
    .filter(r => r.cafeId === cafeId)
    .slice()
    .sort((a, b) => (b.ratedAt ?? "").localeCompare(a.ratedAt ?? ""))
    .map(r => ({
      userId:   r.userId,
      userName: r.userName || "مستخدم",
      userAvatar: r.userAvatar || "",
      stars:    r.stars,
      comment:  r.comment ?? "",
      ratedAt:  r.ratedAt,
    }));
  const stats = getCafeRatingStats(cafeId);
  return res.json({ ratings: list, ...stats });
});

// Upsert a rating (1-5 stars) for the given cafe + user. Submitting again
// replaces the previous rating so each user contributes exactly one entry.
// An optional free-text `comment` and the rater's display name/avatar
// snapshot may accompany the rating.
router.post("/cafes/:id/rate", (req, res): any => {
  const cafeId = req.params.id;
  const cafe = cafes.find(c => c.id === cafeId);
  if (!cafe) return res.status(404).json({ ok: false, error: "الكوفي غير موجود" });
  const userId = String(req.body?.userId ?? "").trim();
  // Hidden showcase cafes can only be rated by showcase viewers.
  if (cafe.showcaseOnly && !isShowcaseViewer(userId)) {
    return res.status(404).json({ ok: false, error: "الكوفي غير موجود" });
  }
  const stars  = Number(req.body?.stars);
  if (!userId) return res.status(400).json({ ok: false, error: "userId مطلوب" });
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ ok: false, error: "التقييم يجب أن يكون بين 1 و 5 نجوم" });
  }
  const comment    = String(req.body?.comment ?? "").trim().slice(0, 500);
  const userName   = String(req.body?.userName ?? "").trim().slice(0, 60);
  const userAvatar = String(req.body?.userAvatar ?? "").trim();
  const idx = cafeRatings.findIndex(r => r.cafeId === cafeId && r.userId === userId);
  const now = new Date().toISOString();
  if (idx >= 0) {
    cafeRatings[idx].stars   = stars;
    cafeRatings[idx].comment = comment;
    if (userName)   cafeRatings[idx].userName   = userName;
    if (userAvatar) cafeRatings[idx].userAvatar = userAvatar;
    cafeRatings[idx].ratedAt = now;
  } else {
    cafeRatings.push({ cafeId, userId, stars, comment, userName, userAvatar, ratedAt: now });
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
  // Canonicalize Omani phones to the 8-digit national number before comparing
  // so format drift can't hide earned codes. The server canonicalizes the
  // stored phone to "+96812345678" (that's what both the `users` and
  // `freeCoffees` collections hold), but a device that registered with a bare
  // local number keeps "12345678" on-device and sends THAT here. A strict
  // string compare — or even a plain digits-only compare — would then return
  // nothing (the +968 country code makes "96812345678" ≠ "12345678") and the
  // user's free-coffee section would look empty even though codes were earned.
  // This mirrors the login matcher (which already bridges "+968…" vs the bare
  // local number) and handles "+968…", "00968…", leading-zero, and spaced
  // variants. Falls back to exact match for non-numeric handles (e.g. the
  // showcase "Copointo" account) whose canonical key is empty.
  const phoneKey = (p: string) => {
    let d = String(p ?? "").replace(/\D+/g, "").replace(/^0+/, "");
    if (d.startsWith("968") && d.length > 8) d = d.slice(3);
    // Only treat a well-formed Omani national number (exactly 8 digits) as a
    // canonical key. Malformed/short remnants return "" and fall through to
    // strict exact match, so they can't collide with a real user's codes.
    return d.length === 8 ? d : "";
  };
  const wantKey = phoneKey(phone);
  const list = freeCoffees
    .filter(f =>
      f.userPhone === phone ||
      (wantKey !== "" && phoneKey(f.userPhone) === wantKey),
    )
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
  res.json({ coffees: list });
});

// ─── Public Broadcasts endpoint ─────────────────────────────────────────
// Mobile fetches system broadcasts (announcements from Copointo super-admin).
// Optional ?since=<ISO> filters to only newer broadcasts.
router.get("/broadcasts", (req, res) => {
  const since  = String(req.query.since  ?? "").trim();
  const userId = String(req.query.userId ?? "").trim();
  const items = broadcasts.filter(b => {
    if (since && !(b.createdAt > since)) return false;
    // Targeted broadcast: only deliver to listed recipients.
    if (Array.isArray(b.toUserIds) && b.toUserIds.length > 0) {
      return userId ? b.toUserIds.includes(userId) : false;
    }
    return true;
  });
  res.json({ broadcasts: items });
});

// Super-admin → push a new system announcement to every game user.
// The list is kept newest-first so the mobile unread-badge logic
// (`r.broadcasts[0].createdAt`) reflects the latest one.
router.post("/broadcasts", (req, res): any => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) return res.status(400).json({ ok: false, error: "الرسالة مطلوبة" });
  const b: Broadcast = {
    id:        `bc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    message,
    createdAt: new Date().toISOString(),
  };
  broadcasts.unshift(b);
  persistStore();
  // Fan-out to every registered device. Body shows the full message so the
  // user can read it from the lock screen without opening the app.
  void sendPushToAll({
    title: "إشعار من Copointo 📣",
    body:  message,
    data:  { type: "broadcast", broadcastId: b.id },
  });
  res.json({ ok: true, broadcast: b });
});

router.delete("/broadcasts/:id", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  const idx = broadcasts.findIndex(b => b.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "not found" });
  broadcasts.splice(idx, 1);
  persistStore();
  res.json({ ok: true });
});

// ─── Monthly leaderboard season ─────────────────────────────────────────
// Returns the current season's endsAt (mobile derives the countdown), the
// reward table, and a preview of who is currently in the top-10 (so the UI
// can show a coin badge next to each of those players). Every call also
// lazily checks whether the season has expired and, if so, awards winners
// + rolls to a fresh 30-day season — see lib/monthlySeason.ts.
router.get("/season/monthly", (_req, res) => {
  const season = checkAndProcessSeasonEnd();
  const preview = rankPlayersForSeason().map((u, i) => ({
    userId:   u.id,
    username: u.username,
    rank:     i + 1,
    amount:   MONTHLY_REWARDS[i]!,
  }));
  res.json({
    season: {
      id:        season.id,
      startedAt: season.startedAt,
      endsAt:    season.endsAt,
    },
    rewards: MONTHLY_REWARDS,
    preview,
  });
});

// ─── Coin Gifts (super-admin → single user) ─────────────────────────────
// Coins are stored client-side (AsyncStorage on the mobile device), so the
// server only records the *intent* to deliver coins. The mobile app polls
// /coin-gifts?userId=... for unclaimed gifts, credits the local balance,
// then POSTs /coin-gifts/:id/claim to mark it consumed.

// Super-admin creates a new gift for a specific user.
router.post("/admin/coin-gifts", (req, res): any => {
  const userId  = String(req.body?.userId ?? "").trim();
  const amount  = Math.floor(Number(req.body?.amount ?? 0));
  const message = String(req.body?.message ?? "").trim()
    || "هدية من شركة كوبوينتو 🎉 شكراً لكونك جزءاً من عائلتنا";
  if (!userId) return res.status(400).json({ ok: false, error: "userId مطلوب" });
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: "العدد يجب أن يكون أكبر من صفر" });
  }
  if (amount > 10_000_000) {
    return res.status(400).json({ ok: false, error: "العدد كبير جداً" });
  }
  const u = users.find(x => x.id === userId);
  if (!u) return res.status(404).json({ ok: false, error: "المستخدم غير موجود" });
  const g: CoinGift = {
    id:        `cg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    amount,
    message,
    createdAt: new Date().toISOString(),
    claimedAt: null,
  };
  coinGifts.unshift(g);
  persistStore();
  // Notify recipient — show the full sender message so it's readable from the
  // lock screen without opening the app.
  void sendPushToUser(userId, {
    title: `🎁 هدية من Copointo`,
    body:  `${message}\n\nاستلمت ${amount} عملة!`,
    data:  { type: "coin_gift", giftId: g.id, amount },
  });
  res.json({ ok: true, gift: g });
});

// Super-admin resets a user's coin balance to zero. Reuses the coin-gifts
// polling pipeline by enqueueing a special CoinGift with reset=true; the
// mobile client zeros out its local balance silently when it sees a reset
// record (no celebration modal).
router.post("/admin/coin-resets", (req, res): any => {
  const userId = String(req.body?.userId ?? "").trim();
  if (!userId) return res.status(400).json({ ok: false, error: "userId مطلوب" });
  const u = users.find(x => x.id === userId);
  if (!u) return res.status(404).json({ ok: false, error: "المستخدم غير موجود" });
  const g: CoinGift = {
    id:        `cr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    amount:    0,
    reset:     true,
    message:   "تم تصفير عملاتك من قبل إدارة Copointo",
    createdAt: new Date().toISOString(),
    claimedAt: null,
  };
  coinGifts.unshift(g);
  persistStore();
  res.json({ ok: true, reset: g });
});

// Super-admin sees the full history of gifts (newest first).
router.get("/admin/coin-gifts", (_req, res) => {
  const enriched = coinGifts.map(g => {
    const u = users.find(x => x.id === g.userId);
    return { ...g, username: u?.username ?? "(محذوف)", phone: u?.phone ?? "" };
  });
  res.json({ gifts: enriched });
});

// Super-admin can withdraw a gift while it's still unclaimed.
router.delete("/admin/coin-gifts/:id", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  const idx = coinGifts.findIndex(g => g.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "not found" });
  if (coinGifts[idx]!.claimedAt) {
    return res.status(400).json({ ok: false, error: "الهدية تم استلامها بالفعل" });
  }
  coinGifts.splice(idx, 1);
  persistStore();
  res.json({ ok: true });
});

// Mobile fetches all UNCLAIMED gifts for a user (newest first).
router.get("/coin-gifts", (req, res): any => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) return res.status(400).json({ ok: false, error: "userId مطلوب" });
  const items = coinGifts.filter(g => g.userId === userId && !g.claimedAt);
  res.json({ gifts: items });
});

// Mobile marks a gift as claimed once the local coin balance is credited.
router.post("/coin-gifts/:id/claim", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  const g = coinGifts.find(x => x.id === id);
  if (!g) return res.status(404).json({ ok: false, error: "not found" });
  if (g.claimedAt) return res.json({ ok: true, gift: g, alreadyClaimed: true });
  g.claimedAt = new Date().toISOString();
  persistStore();
  res.json({ ok: true, gift: g });
});

// ─── Progress Adjustments (super-admin → device-local delta apply) ───────
// See store.ts ProgressAdjustment for the rationale. Mobile polls for
// unclaimed adjustments, applies the delta to its LOCAL level/orders/
// cafeProgress (so the player actually sees the change), then claims.
router.get("/progress-adjustments", (req, res) => {
  const userId = String(req.query.userId ?? "").trim();
  if (!userId) return res.json({ adjustments: [] });
  const items = progressAdjustments.filter(a => a.userId === userId && !a.claimedAt);
  res.json({ adjustments: items });
});

router.post("/progress-adjustments/:id/claim", (req, res): any => {
  const id     = String(req.params.id ?? "").trim();
  const userId = String(req.body?.userId ?? "").trim();
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  const a = progressAdjustments.find(x => x.id === id);
  if (!a) return res.status(404).json({ ok: false, error: "not found" });
  // Ownership check — only the user the adjustment is addressed to may claim it.
  if (a.userId !== userId) return res.status(403).json({ ok: false, error: "forbidden" });
  if (a.claimedAt) return res.json({ ok: true, adjustment: a, alreadyClaimed: true });
  a.claimedAt = new Date().toISOString();
  persistStore();
  res.json({ ok: true, adjustment: a });
});

// ─── Public Reels endpoints ─────────────────────────────────────────────
// Engagement-ranked feed: score = likes*3 + comments*5 + views*0.05, with a
// recency boost so brand-new reels still surface.
router.get("/reels", async (req, res) => {
  const userId = String(req.query.userId ?? "").trim();

  const viewer = isShowcaseViewer(userId);
  const visibleReels = reels.filter(r => viewer || !r.showcaseOnly);
  const now = Date.now();
  const enriched = visibleReels.map(r => {
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
router.get("/reels/:rid/video", async (req, res): Promise<any> => {
  const r = reels.find(x => x.id === req.params.rid);
  if (!r || !r.videoUrl) return res.status(404).end();

  // Mode A (current): GCS Object Storage ("gcs:<key>") — durable across
  // deploys. Stream from GCS with HTTP Range support.
  if (r.videoUrl.startsWith("gcs:")) {
    try {
      const key = r.videoUrl.slice(4);
      const file = reelFile(key);
      const [meta] = await file.getMetadata();
      const total = Number(meta.size ?? 0);
      const mime = (meta.contentType as string) || "video/mp4";
      res.setHeader("Content-Type", mime);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=3600");
      const range = req.headers.range;
      if (range && total > 0) {
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
          return file.createReadStream({ start, end }).pipe(res);
        }
      }
      if (total) res.setHeader("Content-Length", String(total));
      return file.createReadStream().pipe(res);
    } catch (err: any) {
      req.log?.error?.({ err, reelId: r.id }, "reel GCS stream failed");
      return res.status(404).end();
    }
  }

  // Mode B (legacy): on-disk file ("file:<filename>"). Used by reels uploaded
  // before the GCS migration. Stream from disk with HTTP Range support.
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

  // Mode C: external http(s) URL (used by the showcase seed, which points
  // reels at public Pexels MP4 URLs). The reels list endpoint always rewrites
  // `videoUrl` to `/api/reels/:id/video`, so when the underlying source is an
  // external URL we just 302-redirect the player there. The browser <video>
  // and expo-video both follow the redirect transparently and still get HTTP
  // Range support from the upstream host.
  if (/^https?:\/\//i.test(r.videoUrl)) {
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.redirect(302, r.videoUrl);
  }

  // Mode D (legacy): inline data URL kept for backward compatibility with
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
router.post("/users/register", async (req, res): Promise<any> => {
  const id        = String(req.body?.id ?? "").trim();
  const username  = normalizeUsername(req.body?.username);
  const phone     = String(req.body?.phone ?? "").trim();
  const joinedAt  = String(req.body?.joinedAt ?? "").trim() || new Date().toISOString();
  const otpToken  = String(req.body?.otpToken ?? "").trim();
  // Normalize phone strings so "+968 1234 5678" and "+96812345678" compare
  // as equal everywhere (OTP match, uniqueness, etc).
  const norm = (p: string) => p.replace(/\s+/g, "").replace(/(?!^\+)\D/g, "");

  // ─── Step 1: cheap field validation BEFORE consuming any OTP token, so a
  // bad/empty payload doesn't burn the user's single-use code. ───
  if (!id)       return res.status(400).json({ ok: false, error: "id required" });
  if (!username) return res.status(400).json({ ok: false, error: "يوزر اللعبة مطلوب" });
  if (!phone)    return res.status(400).json({ ok: false, error: "رقم الهاتف مطلوب" });
  if (username.length < 3 || username.length > 24) {
    return res.status(400).json({ ok: false, error: "يوزر اللعبة يجب أن يكون بين 3 و 24 حرفاً" });
  }

  // ─── Step 2: uniqueness checks — also BEFORE OTP consumption. Using
  // normalized phone equality so "+968 1234 5678" can't sneak past as a
  // different account than "+96812345678". ───
  const usernameKey = username.toLowerCase();
  const usernameClash = usernameRegistry.find(u => u.username === usernameKey && u.userId !== id);
  if (usernameClash) return res.status(409).json({ ok: false, error: "يوزر اللعبة مستخدم مسبقاً" });
  const phoneClash = users.find(u => norm(u.phone) === norm(phone) && u.id !== id);
  if (phoneClash) {
    // If the existing account on this phone is banned, surface that to the
    // client so it can show the ban screen instead of a generic "phone
    // already registered" error — prevents banned users from re-registering
    // with the same phone number.
    if (phoneClash.banned) {
      return res.status(403).json({
        ok: false,
        banned: true,
        banReason: phoneClash.banReason || "تم حظر هذا الحساب من قِبل إدارة كوبوينتو",
        error: "تم حظر هذا الحساب من الموقع",
      });
    }
    return res.status(409).json({ ok: false, error: "رقم الهاتف مسجّل مسبقاً" });
  }
  // Same protection on the username side: a banned user can't reclaim their
  // banned game username from a fresh device.
  const usernameClashUser = users.find(u => u.username.toLowerCase() === usernameKey && u.id !== id);
  if (usernameClashUser && usernameClashUser.banned) {
    return res.status(403).json({
      ok: false,
      banned: true,
      banReason: usernameClashUser.banReason || "تم حظر هذا الحساب من قِبل إدارة كوبوينتو",
      error: "تم حظر هذا الحساب من الموقع",
    });
  }

  // ─── Step 3: OTP gate (after validation, before mutation). ───
  //   • New accounts → OTP must match the NEW phone (proves the signer
  //     owns the phone they're registering).
  //   • Existing account being mutated (phone or username change) → OTP
  //     must match the CURRENT phone on file. This is the critical
  //     authorization check: anyone can read another user's id+username
  //     from the public roster, so without binding the OTP to the
  //     existing phone an attacker could rebind a victim's account to
  //     their own number. Requiring the code to land on the *current*
  //     owner's phone proves the request is consented.
  //   • Pure idempotent calls (same id, same phone, same username) skip
  //     the gate so login-backfill works without reprompting.
  const existing = users.find(u => u.id === id);
  const isMutatingExisting =
    existing && (norm(existing.phone) !== norm(phone) || existing.username.toLowerCase() !== usernameKey);
  if (!existing || isMutatingExisting) {
    if (!otpToken) {
      return res.status(401).json({ ok: false, error: "رمز التحقق مطلوب" });
    }
    const v = consumeOtpToken(otpToken, "register");
    if (!v) {
      return res.status(401).json({ ok: false, error: "انتهت صلاحية رمز التحقق — أعد الإرسال" });
    }
    const expectedPhone = existing ? existing.phone : phone;
    if (norm(v.phone) !== norm(expectedPhone)) {
      return res.status(401).json({
        ok: false,
        error: existing
          ? "لتعديل الحساب يجب التحقق من الرقم الحالي المسجَّل عليه"
          : "رقم الهاتف لا يطابق الرمز الذي تم التحقق منه",
      });
    }
  }

  // Both checks passed — commit username claim and user row together.
  for (let i = usernameRegistry.length - 1; i >= 0; i--) {
    if (usernameRegistry[i].userId === id) usernameRegistry.splice(i, 1);
  }
  usernameRegistry.push({
    username: usernameKey, display: username, userId: id,
    claimedAt: new Date().toISOString(),
  });

  if (existing) {
    // Idempotent: refresh username/phone but preserve game state, ban flags,
    // totalOrders earned through real orders, etc.
    existing.username = username;
    existing.phone    = phone;
    // Synchronous flush — see flushNow() docs. Must complete BEFORE the
    // client gets the success response so subsequent /users/:id/status
    // polls (possibly served by a different autoscale instance) cannot
    // race and report exists:false for an account we just confirmed.
    try { await flushNow(); } catch { /* persistStore safety net will retry */ }
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
  try { await flushNow(); } catch { /* persistStore safety net will retry */ }
  res.json({ ok: true, user: u });
});

// ─── Password reset (verify OTP token) ──────────────────────────────────
// Mobile passwords live device-local in AsyncStorage; this endpoint just
// validates the OTP token and returns the canonical phone so the client
// can safely overwrite the local password for that account. Token is
// single-use server-side, so a successful call cannot be replayed.
router.post("/auth/password/reset-confirm", (req, res): any => {
  const token = String(req.body?.otpToken ?? "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "رمز التحقق مطلوب" });
  const v = consumeOtpToken(token, "reset");
  if (!v) return res.status(401).json({ ok: false, error: "انتهت صلاحية رمز التحقق — أعد الإرسال" });
  return res.json({ ok: true, phone: v.phone });
});

// ─── User status (ban poll) ──────────────────────────────────────────────
// The mobile app polls this endpoint every few seconds while the user is
// signed in. If `banned` flips to true the AuthGate replaces the whole UI
// with a "you've been banned" screen showing `banReason` and a logout
// button — the only action allowed for a banned user.
router.get("/users/:id/status", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  const u = users.find(x => x.id === id);
  if (!u) return res.json({ ok: true, exists: false, banned: false });
  res.json({
    ok: true,
    exists: true,
    banned: !!u.banned,
    banReason: u.banReason ?? null,
    bannedAt:  u.bannedAt  ?? null,
    // Inventory mirror for the mobile push-down sync. The client compares
    // `syncVersion` against its locally-applied version and overwrites its
    // AsyncStorage coins/owned-items only when the server's is newer (i.e.
    // a super-admin edit happened). `null` syncVersion ⇒ never admin-edited.
    coins:       typeof u.coins === "number" ? u.coins : null,
    ownedItems:  u.ownedItems ?? null,
    syncVersion: typeof u.syncVersion === "number" ? u.syncVersion : null,
  });
});

// ─── User self-delete (mobile profile → "delete account permanently") ───
// Hard-purges the user and every personal record (game progress, free
// coffees, reel engagement, chats, friend graph, reports, ratings). Cafe
// business records (orders, bookings) are kept but anonymized so revenue
// history stays intact. The phone is freed so the same number can register
// fresh as a brand-new account afterwards.
//
// Authorization: the caller must echo back the phone currently on file for
// `:id`. The mobile app already has the phone in its local user state, but
// requiring it here prevents an attacker who only knows a victim's id from
// nuking their account.
router.post("/users/:id/delete", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  const u = users.find(x => x.id === id);
  if (!u) return res.status(404).json({ ok: false, error: "المستخدم غير موجود" });
  const norm = (s: unknown) => String(s ?? "").replace(/\D+/g, "");
  const provided = norm(req.body?.phone);
  if (!provided || provided !== norm(u.phone)) {
    return res.status(403).json({ ok: false, error: "تعذّر التحقق من ملكية الحساب" });
  }
  const ok = purgeUserData(id);
  if (!ok) return res.status(404).json({ ok: false, error: "المستخدم غير موجود" });
  res.json({ ok: true });
});

// ─── User self-reset ─────────────────────────────────────────────────────
// Zeroes the player's server-side game stats (level / totalOrders) so the
// account behaves like a brand-new signup again. Phone, username, and ban
// flags are intentionally preserved. Used by the "Reset account" button in
// the mobile profile screen.
router.post("/users/:id/reset", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  const u = users.find(x => x.id === id);
  if (!u) return res.status(404).json({ ok: false, error: "user not found" });
  u.level = 0;
  u.totalOrders = 0;
  persistStore();
  res.json({ ok: true, user: u });
});

// ─── Public users list (mobile leaderboard) ──────────────────────────────
// Every mobile device should see EVERY registered player on the platform —
// not just the accounts created on its own AsyncStorage. The leaderboard
// hits this endpoint to merge the global roster with whatever local profile
// data it already has. Banned / game-banned players are filtered out so
// they don't appear in any ranking.
// ─── Push notification token registration ───────────────────────────────
// The mobile app POSTs its Expo push token here right after the user opts
// in to notifications (and on every cold-start to refresh staleness). If
// the same token previously belonged to another user (e.g. someone else
// logged in on this device) we reassign it so the previous account stops
// receiving notifications meant for the new owner.
router.post("/users/:id/push-token", (req, res): any => {
  const userId   = String(req.params.id ?? "").trim();
  const token    = String(req.body?.token ?? "").trim();
  const platform = (String(req.body?.platform ?? "unknown").trim().toLowerCase()) as PushToken["platform"];
  if (!userId || !token) return res.status(400).json({ ok: false, error: "userId/token required" });
  if (!users.find(u => u.id === userId)) {
    return res.status(404).json({ ok: false, error: "user not found" });
  }
  const safePlatform: PushToken["platform"] =
    platform === "ios" || platform === "android" || platform === "web" ? platform : "unknown";
  const now = new Date().toISOString();
  // Reassign any existing rows for this token to the current user.
  const existing = pushTokens.find(p => p.token === token);
  if (existing) {
    existing.userId    = userId;
    existing.platform  = safePlatform;
    existing.updatedAt = now;
  } else {
    pushTokens.push({
      id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId, token, platform: safePlatform, updatedAt: now,
    });
  }
  persistStore();
  res.json({ ok: true });
});

// ─── Web Push (browser) endpoints ────────────────────────────────────
// Used by the Copointo Expo web build (i.e. copointo.com opened in a
// phone/desktop browser). The browser registers a service worker,
// fetches the VAPID public key from us, subscribes to its push service,
// and POSTs the resulting subscription so the server can deliver
// notifications via web-push (handled in lib/webPush.ts).

router.get("/push/web/vapid-public-key", (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.post("/push/web/subscribe", (req, res): any => {
  const userId = String(req.body?.userId ?? "").trim();
  const sub    = req.body?.subscription;
  const ua     = typeof req.body?.userAgent === "string" ? String(req.body.userAgent).slice(0, 300) : undefined;
  if (!userId || !sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ ok: false, error: "userId/subscription required" });
  }
  if (!users.find(u => u.id === userId)) {
    return res.status(404).json({ ok: false, error: "user not found" });
  }
  // Endpoint uniquely identifies a browser-on-device subscription. If
  // the same endpoint was previously registered to a different user
  // (e.g. account switch on the same browser) reassign it.
  const existing = webPushSubscriptions.find(s => s.endpoint === sub.endpoint);
  const now = new Date().toISOString();
  if (existing) {
    existing.userId  = userId;
    existing.keys    = { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) };
    existing.userAgent = ua;
  } else {
    webPushSubscriptions.push({
      id: `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      endpoint: String(sub.endpoint),
      keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) },
      userAgent: ua,
      createdAt: now,
    });
  }
  persistStore();
  res.json({ ok: true });
});

router.post("/push/web/unsubscribe", (req, res): any => {
  const userId   = String(req.body?.userId ?? "").trim();
  const endpoint = String(req.body?.endpoint ?? "").trim();
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  let removed = 0;
  for (let i = webPushSubscriptions.length - 1; i >= 0; i--) {
    const row = webPushSubscriptions[i]!;
    if (row.userId !== userId) continue;
    if (endpoint && row.endpoint !== endpoint) continue;
    webPushSubscriptions.splice(i, 1);
    removed++;
  }
  if (removed > 0) persistStore();
  res.json({ ok: true, removed });
});

// Mobile calls this on logout or when the user disables notifications.
// Removes all push tokens for the user (or just the one matching the
// specific token if `token` is provided in the body/query).
router.delete("/users/:id/push-token", (req, res): any => {
  const userId = String(req.params.id ?? "").trim();
  const token  = String(req.body?.token ?? req.query?.token ?? "").trim();
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });
  let removed = 0;
  for (let i = pushTokens.length - 1; i >= 0; i--) {
    const row = pushTokens[i]!;
    if (row.userId !== userId) continue;
    if (token && row.token !== token) continue;
    pushTokens.splice(i, 1);
    removed++;
  }
  if (removed > 0) persistStore();
  res.json({ ok: true, removed });
});

router.get("/users/public", async (req, res) => {

  const viewer = isShowcaseViewer(String(req.query.userId ?? ""));
  res.json({
    users: users
      .filter(u => !u.banned && !u.gameBanned && (viewer || !u.showcaseOnly))
      .map(u => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        level: u.level ?? 0,
        totalOrders: u.totalOrders ?? 0,
        joinedAt: u.joinedAt,
        // Mirrored profile bits so other devices show the real avatar/name/gender.
        name:   u.name   ?? null,
        avatar: u.avatar ?? null,
        gender: u.gender ?? null,
        equippedFrame:         u.equippedFrame         ?? null,
        equippedBadge:         u.equippedBadge         ?? null,
        equippedBackground:    u.equippedBackground    ?? null,
        equippedCharacter:     u.equippedCharacter     ?? null,
        equippedUsernameColor: u.equippedUsernameColor ?? null,
        equippedTextStyle:     u.equippedTextStyle     ?? null,
        // Per-cafe progress mirror (admin-adjusted). Mobile merges via
        // Math.max so device-side progress is never rolled back.
        cafeProgress: u.cafeProgress ?? null,
      })),
  });
});

// ─── Profile mirror (name / avatar / gender) ─────────────────────────────
// Mobile pushes profile updates here so OTHER devices' leaderboards show
// the real picture / name / gender. No OTP required — these fields are
// public display data, not credentials. Empty/missing values clear the
// mirrored field (e.g. user removed their photo).
router.post("/users/profile", (req, res): any => {
  const id = String(req.body?.id ?? "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  const u = users.find(x => x.id === id);
  if (!u) return res.status(404).json({ ok: false, error: "user not found" });
  if ("name" in (req.body ?? {})) {
    const v = String(req.body.name ?? "").trim();
    if (v) u.name = v; else delete u.name;
  }
  if ("avatar" in (req.body ?? {})) {
    const v = String(req.body.avatar ?? "").trim();
    if (v) u.avatar = v; else delete u.avatar;
  }
  if ("gender" in (req.body ?? {})) {
    const v = String(req.body.gender ?? "").trim();
    if (v === "male" || v === "female") u.gender = v;
    else delete u.gender;
  }
  persistStore();
  res.json({ ok: true });
});

// ─── Inventory push-up (coins + owned cosmetics) ─────────────────────────
// The mobile client mirrors its LOCAL coin balance + owned-item lists here
// so the super-admin can SEE them in the admin dashboard. This is a plain
// snapshot write and does NOT bump syncVersion — only admin edits bump it,
// so the client's own push-up can never trigger a self push-down.
router.post("/users/inventory", (req, res): any => {
  const id = String(req.body?.id ?? "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  const u = users.find(x => x.id === id);
  if (!u) return res.status(404).json({ ok: false, error: "user not found" });
  // Version-gate the push-up: if an admin edited this account AFTER the device
  // last reconciled, the server's syncVersion is newer than the version the
  // device reports as applied. Reject the (stale) push so it can't clobber the
  // fresh admin edit — the device will pull the edit on its next status poll
  // and only then push again with the matching version.
  const serverVersion = u.syncVersion ?? 0;
  const clientVersion = Math.floor(Number(req.body?.clientSyncVersion ?? serverVersion));
  if (Number.isFinite(clientVersion) && clientVersion < serverVersion) {
    return res.json({ ok: false, stale: true, syncVersion: serverVersion });
  }
  if ("coins" in (req.body ?? {})) {
    const c = Math.floor(Number(req.body.coins));
    if (Number.isFinite(c)) u.coins = Math.max(0, c);
  }
  if (req.body?.ownedItems && typeof req.body.ownedItems === "object") {
    const body = req.body.ownedItems;
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? Array.from(new Set(v.map(String))) : [];
    u.ownedItems = {
      frames:         arr(body.frames),
      badges:         arr(body.badges),
      backgrounds:    arr(body.backgrounds),
      characters:     arr(body.characters),
      usernameColors: arr(body.usernameColors),
      textStyles:     arr(body.textStyles),
    };
  }
  persistStore();
  res.json({ ok: true });
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
  // ── Per-cafe progress mirror (new) ────────────────────────────────────
  // Mobile addCafeOrder now pushes the per-cafe counters too so server's
  // cafeProgress stays in sync with the device's local view. Without this
  // the brief window between order placement and order status-change
  // (when awardOrderProgress fires server-side) leaves server.cafeProgress
  // stale, which then causes mobile's refresh to silently revert the
  // count after admin's set takes effect.
  const cafeId           = typeof req.body?.cafeId === "string" ? req.body.cafeId.trim() : "";
  const cafeLevel        = Number(req.body?.cafeLevel        ?? NaN);
  const cafeTotalOrders  = Number(req.body?.cafeTotalOrders  ?? NaN);
  if (cafeId && (Number.isFinite(cafeLevel) || Number.isFinite(cafeTotalOrders))) {
    const prog = (u.cafeProgress ??= {});
    const curr = prog[cafeId] ?? { level: 0, totalOrders: 0 };
    const nextLvl = Number.isFinite(cafeLevel)
      ? Math.max(curr.level ?? 0, Math.min(999, Math.floor(cafeLevel)))
      : curr.level ?? 0;
    const nextOrd = Number.isFinite(cafeTotalOrders)
      ? Math.max(curr.totalOrders ?? 0, Math.floor(cafeTotalOrders))
      : curr.totalOrders ?? 0;
    if (nextLvl !== curr.level || nextOrd !== curr.totalOrders) {
      prog[cafeId] = { level: nextLvl, totalOrders: nextOrd };
      // Recompute globals from union so the invariant holds even when
      // the mobile push raises this cafe above the previous global max.
      // Per product spec: globals are SUMS across cafes (level == totalOrders
      // == Σ per-cafe levels). Both branches must reduce-sum, not Math.max,
      // otherwise a user with cups across multiple cafes would have their
      // global level shrunk to just the single max cafe.
      const allLvls = Object.values(prog).map(c => c.level ?? 0);
      const allOrds = Object.values(prog).map(c => c.totalOrders ?? 0);
      const sumLvls = allLvls.reduce((s, n) => s + n, 0);
      const sumOrds = allOrds.reduce((s, n) => s + n, 0);
      u.level       = Math.max(u.level ?? 0, sumLvls);
      u.totalOrders = Math.max(u.totalOrders ?? 0, sumOrds);
      changed = true;
    }
  }
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

// ─── Equipment sync (cosmetics: frame / badge / bg / character / etc.) ───
// Mirrors the user's equipped cosmetic IDs to the server so OTHER devices
// can render this player's loadout on profile, leaderboard, chat, etc.
// Each call updates a SINGLE key so the request stays small and idempotent.
router.post("/users/equipment", (req, res): any => {
  const id  = String(req.body?.id ?? "").trim();
  const key = String(req.body?.key ?? "").trim();
  const raw = req.body?.value;
  const value: string | null =
    raw === null || raw === undefined || raw === "" ? null : String(raw);
  if (!id) return res.status(400).json({ ok: false, error: "id required" });
  const allowed: Record<string, keyof AppUser> = {
    frame:         "equippedFrame",
    badge:         "equippedBadge",
    background:    "equippedBackground",
    character:     "equippedCharacter",
    usernameColor: "equippedUsernameColor",
    textStyle:     "equippedTextStyle",
  };
  const field = allowed[key];
  if (!field) return res.status(400).json({ ok: false, error: "invalid key" });
  const u = users.find(x => x.id === id);
  if (!u) return res.status(404).json({ ok: false, error: "user not found" });
  (u as any)[field] = value;
  persistStore();
  res.json({ ok: true });
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
  // Notify the recipient — body shows the sender's display name so the
  // user can decide to accept/decline straight from the notification.
  const sender = users.find(u => u.id === fromUserId);
  const senderName = sender?.username || "صديق جديد";
  void sendPushToUser(toUserId, {
    title: "طلب صداقة جديد 👋",
    body:  `${senderName} يريد إضافتك صديقاً`,
    data:  { type: "friend_request", requestId: fr.id, fromUserId },
  });
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

// ─── Chat media attachments (images / videos / voice notes) ──────────────
// Mobile clients POST a multipart file under field name "file" along with
// a "kind" field ("image"|"video"|"audio"). The bytes are uploaded to GCS
// Object Storage and the returned `{ url }` is referenced from the chat
// message (imageUrl / videoUrl / audioUrl). The serve endpoint streams the
// bytes back with HTTP Range support.
const CHAT_MEDIA_DIR = path.join(process.cwd(), "uploads", "chat-media");
fs.mkdirSync(CHAT_MEDIA_DIR, { recursive: true });
// Per-kind size caps — images small, audio modest, video larger.
const CHAT_MEDIA_MAX = 50 * 1024 * 1024; // 50 MB upper bound (multer hard limit)
const CHAT_MEDIA_KIND_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024, // 10 MB
  audio: 15 * 1024 * 1024, // 15 MB
  video: 50 * 1024 * 1024, // 50 MB
};
// MIME allowlist by kind — magic-byte sniffing isn't worth the dep here, but
// at least reject obviously wrong content-types so the bucket can't be used
// as a generic file host.
const CHAT_MEDIA_KIND_MIMES: Record<string, RegExp> = {
  image: /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i,
  audio: /^audio\/(mp4|mpeg|mp3|aac|wav|x-wav|x-m4a|webm|ogg|x-caf)$/i,
  video: /^video\/(mp4|quicktime|webm|x-matroska|3gpp)$/i,
};
const chatMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CHAT_MEDIA_DIR),
    filename:    (_req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".bin";
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: CHAT_MEDIA_MAX },
});
function chatMediaUploadSafe(req: any, res: any, next: any) {
  chatMediaUpload.single("file")(req, res, (err: any) => {
    if (!err) return next();
    let message = err?.message || "فشل رفع الملف";
    if (err?.code === "LIMIT_FILE_SIZE") {
      message = "حجم الملف كبير جداً — الحد الأقصى 50 ميجابايت";
    }
    req.log?.error?.({ err, code: err?.code }, "chat media upload failed");
    return res.status(400).json({ error: message, code: err?.code ?? "UPLOAD_ERROR" });
  });
}
router.post("/chat-media", chatMediaUploadSafe, async (req: any, res): Promise<any> => {
  if (!req.file) return res.status(400).json({ error: "no file uploaded" });
  const cleanup = () => { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } };
  const kind = String(req.body?.kind ?? "").toLowerCase();
  const mime = (req.file.mimetype || "application/octet-stream").toLowerCase();
  // Validate kind + MIME + per-kind size.
  const allowedMime = CHAT_MEDIA_KIND_MIMES[kind];
  if (!allowedMime) {
    cleanup();
    return res.status(400).json({ error: "نوع المرفق غير مدعوم", code: "BAD_KIND" });
  }
  if (!allowedMime.test(mime)) {
    cleanup();
    return res.status(400).json({ error: "نوع الملف غير مسموح به", code: "BAD_MIME" });
  }
  if (req.file.size > (CHAT_MEDIA_KIND_LIMITS[kind] ?? CHAT_MEDIA_MAX)) {
    cleanup();
    return res.status(400).json({ error: "حجم الملف يتجاوز الحد المسموح", code: "TOO_LARGE" });
  }
  try {
    const ext = path.extname(req.file.filename || "") || "";
    const key = await uploadChatMediaFile(req.file.path, ext, mime);
    cleanup();
    return res.status(201).json({ url: `gcs:${key}` });
  } catch (err: any) {
    req.log?.error?.({ err }, "chat media GCS upload failed");
    cleanup();
    return res.status(500).json({ error: "فشل رفع المرفق إلى التخزين السحابي", detail: err?.message });
  }
});

// Stream a chat-media binary with HTTP Range so images load progressively,
// audio scrubs, and video can seek. Key arrives URL-encoded because it
// contains a slash ("chat-media/<uuid>.<ext>").
router.get("/chat-media/:key/stream", async (req, res): Promise<any> => {
  const rawKey = decodeURIComponent(String(req.params.key ?? ""));
  // Defence-in-depth: only allow our own chat-media prefix.
  if (!rawKey.startsWith("chat-media/")) return res.status(400).end();
  try {
    const file = chatMediaFile(rawKey);
    const [meta] = await file.getMetadata();
    const total = Number(meta.size ?? 0);
    const mime = (meta.contentType as string) || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const range = req.headers.range;
    if (range && total > 0) {
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
        return file.createReadStream({ start, end }).pipe(res);
      }
    }
    if (total) res.setHeader("Content-Length", String(total));
    return file.createReadStream().pipe(res);
  } catch (err: any) {
    req.log?.error?.({ err, key: rawKey }, "chat media stream failed");
    return res.status(404).end();
  }
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
  const giftId      = String(req.body?.giftId ?? "").trim();
  const giftQtyRaw  = parseInt(String(req.body?.giftQty ?? "1"), 10);
  const giftQty     = Number.isFinite(giftQtyRaw) ? Math.max(1, Math.min(99, giftQtyRaw)) : 1;
  const senderNameIn    = String(req.body?.senderName    ?? "").trim().slice(0, 64);
  const recipientNameIn = String(req.body?.recipientName ?? "").trim().slice(0, 64);
  const imageUrl  = String(req.body?.imageUrl  ?? "").trim();
  const videoUrl  = String(req.body?.videoUrl  ?? "").trim();
  const audioUrl  = String(req.body?.audioUrl  ?? "").trim();
  const mediaDurRaw = parseInt(String(req.body?.mediaDuration ?? "0"), 10);
  const mediaDuration = Number.isFinite(mediaDurRaw) && mediaDurRaw > 0
    ? Math.min(3600, mediaDurRaw) : undefined;
  // Allow empty text when the message carries a media attachment (voice
  // note / photo / video send no caption by default).
  const hasMedia = !!(imageUrl || videoUrl || audioUrl);
  if (!id || !senderId || (!text && !hasMedia)) {
    return res.status(400).json({ error: "id/senderId/text-or-media required" });
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
  if (giftId) {
    msg.giftId = giftId;
    msg.giftQty = giftQty;
    if (senderNameIn)    msg.senderName    = senderNameIn;
    if (recipientNameIn) msg.recipientName = recipientNameIn;
  }
  if (imageUrl)       msg.imageUrl      = imageUrl;
  if (videoUrl)       msg.videoUrl      = videoUrl;
  if (audioUrl)       msg.audioUrl      = audioUrl;
  if (mediaDuration)  msg.mediaDuration = mediaDuration;
  chatMessages.push(msg);
  persistStore();
  // Push notification — only for 1:1 friend messages. Group push fan-out
  // would require resolving every member of the group; skipped for now to
  // keep this change focused. Messages sent BY Copointo go through the
  // separate admin.ts endpoint which has its own push, so we skip here
  // when the sender is the Copointo admin to avoid double-firing.
  if (kind === "friend" && senderId !== "copointo-admin") {
    const sender = users.find(u => u.id === senderId);
    const senderName = sender?.username || senderNameIn || "صديق";
    // Gift messages get a richer title so the recipient knows it's a gift.
    const isGift = !!giftId;
    void sendPushToUser(recipientId, {
      title: isGift ? `🎁 ${senderName} أرسل لك هدية` : `💬 ${senderName}`,
      body:  text.length > 200 ? text.slice(0, 200) + "…" : text,
      data:  {
        type: "chat_message",
        messageId: id,
        senderId,
        kind: "friend",
        ...(isGift ? { giftId, giftQty } : {}),
      },
    });
  }
  res.status(201).json({ ok: true, message: msg });
});

/**
 * Public gift feed — returns the latest N gift events globally so every
 * device can show "X gifted Y a 💎" tickers (e.g. on the levels screen).
 * Only friend-kind gift messages are exposed (group gifts are private to
 * the group). Includes sender + recipient display names so the client
 * doesn't need to look them up.
 */
router.get("/gift-feed", (req, res): any => {
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const giftMsgs = chatMessages
    .filter(m => m.giftId && m.kind === "friend")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  const events = giftMsgs.map(m => {
    const [a, b] = m.scope.split("|");
    const recipientId = m.senderId === a ? (b ?? a) : a;
    const sender    = users.find(u => u.id === m.senderId);
    const recipient = users.find(u => u.id === recipientId);
    return {
      id: m.id,
      giftId: m.giftId!,
      giftQty: m.giftQty ?? 1,
      senderId: m.senderId,
      // Prefer the username captured at send time; fall back to the
      // server's user roster, then to a neutral placeholder.
      senderName: m.senderName || sender?.username || "مستخدم",
      recipientId,
      recipientName: m.recipientName || recipient?.username || "مستخدم",
      createdAt: m.createdAt,
    };
  });
  res.json({ events, now: new Date().toISOString() });
});

/**
 * Total number of gifts a user has received (sum of giftQty across every
 * friend gift message where they are the recipient). Lightweight enough
 * to compute on every call from in-memory `chatMessages`.
 */
router.get("/users/:id/received-gifts", (req, res): any => {
  const userId = String(req.params.id ?? "").trim();
  if (!userId) return res.status(400).json({ error: "id required" });
  let total = 0;
  for (const m of chatMessages) {
    if (!m.giftId || m.kind !== "friend") continue;
    const [a, b] = m.scope.split("|");
    const recipientId = m.senderId === a ? (b ?? a) : a;
    if (recipientId === userId) total += (m.giftQty ?? 1);
  }
  res.json({ userId, total });
});

/**
 * Total number of gifts a user has SENT (sum of giftQty across every
 * friend gift message where they are the sender). Mirrors the
 * received-gifts endpoint and is cheap to compute from in-memory state.
 */
router.get("/users/:id/sent-gifts", (req, res): any => {
  const userId = String(req.params.id ?? "").trim();
  if (!userId) return res.status(400).json({ error: "id required" });
  let total = 0;
  for (const m of chatMessages) {
    if (!m.giftId || m.kind !== "friend") continue;
    if (m.senderId === userId) total += (m.giftQty ?? 1);
  }
  res.json({ userId, total });
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
    ? visible.filter(m =>
        m.createdAt > since
        || (m.senderId === userId && m.seenBy.length > 1)
        || (m.deletedAt !== undefined && m.deletedAt > since)
      )
    : visible;

  filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ messages: filtered, now: new Date().toISOString() });
});

/**
 * Mark every message in a conversation scope as seen by `userId`. The
 * recipient calls this when they open the chat — the sender will see ✓✓
 * after their next poll picks up the updated `seenBy` list.
 */
/**
 * Delete a message "for everyone". Only the original sender may do this.
 * The row is kept (so deletion propagates via the existing poll loop) but
 * its `text` is cleared and `deletedForAll` is set to true. Clients render
 * a localized placeholder bubble instead of the original text.
 */
router.post("/messages/delete", (req, res): any => {
  const id       = String(req.body?.id ?? "").trim();
  const senderId = String(req.body?.senderId ?? "").trim();
  if (!id || !senderId) return res.status(400).json({ error: "id/senderId required" });
  const msg = chatMessages.find(m => m.id === id);
  if (!msg) return res.status(404).json({ error: "not found" });
  if (msg.senderId !== senderId) return res.status(403).json({ error: "only sender can delete" });
  if (!msg.deletedForAll) {
    msg.deletedForAll = true;
    msg.text = "";
    msg.deletedAt = new Date().toISOString();
    persistStore();
  }
  res.json({ ok: true, message: msg });
});

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

// ─── Public report submission (mobile app) ─────────────────────────────
// Body: { kind: "problem" | "cafe", name, phone, description, cafeId?, reporterUserId? }
// Stored in `reports` and shown to the super-admin in the "البلاغات" tab.
router.post("/reports", (req, res): any => {
  const kind = req.body?.kind === "cafe" ? "cafe" : "problem";
  const name = String(req.body?.name ?? "").trim();
  const phone = String(req.body?.phone ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  if (!name)        return res.status(400).json({ error: "الاسم مطلوب" });
  if (!phone)       return res.status(400).json({ error: "رقم الهاتف مطلوب" });
  if (!description) return res.status(400).json({ error: "وصف المشكلة مطلوب" });
  if (description.length > 2000) return res.status(400).json({ error: "الوصف طويل جداً" });

  let cafeId: string | undefined;
  let cafeName: string | undefined;
  if (kind === "cafe") {
    cafeId = String(req.body?.cafeId ?? "").trim();
    if (!cafeId) return res.status(400).json({ error: "cafeId مطلوب لبلاغ الكوفي" });
    const cafe = cafes.find(c => c.id === cafeId);
    if (!cafe) return res.status(404).json({ error: "الكوفي غير موجود" });
    cafeName = cafe.name;
  }

  const r: Report = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    kind,
    name,
    phone,
    description,
    cafeId,
    cafeName,
    reporterUserId: String(req.body?.reporterUserId ?? "").trim() || undefined,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  reports.push(r);
  persistStore();
  res.json({ ok: true, report: r });
});

// ─── Communities (game clans) ────────────────────────────────────────────
// Single global pool. Clients PUT the full updated community state; the
// server is just shared storage. Polling keeps every device in sync within
// a few seconds. Invites are recipient-scoped so each user only fetches
// the invites that target them.

/**
 * GET /communities[?userId=X]
 *   → { communities: Community[], invites: CommunityInvite[] }
 * `communities` is the FULL global list (used by the leaderboard ranking).
 * `invites` is filtered to the requesting user when `userId` is given.
 */
router.get("/communities", async (req, res): Promise<any> => {
  const userId = String(req.query.userId ?? "").trim();

  const viewer = isShowcaseViewer(userId);
  const allComs = communities.filter(c => viewer || !c.showcaseOnly);
  const invs = userId
    ? communityInvites.filter(i => i.toUserId === userId)
    : [];
  res.json({ communities: allComs, invites: invs });
});

/** PUT /communities/:id — upsert (replace) a community's state. */
router.put("/communities/:id", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  const name = String(req.body?.name ?? "").trim();
  const createdBy = String(req.body?.createdBy ?? "").trim();
  const members = Array.isArray(req.body?.members)
    ? req.body.members.map((x: unknown) => String(x)).filter(Boolean)
    : [];
  if (!id || !name || !createdBy || members.length === 0) {
    return res.status(400).json({ error: "id/name/createdBy/members required" });
  }
  const avatar = req.body?.avatar ? String(req.body.avatar) : undefined;
  const rolesIn = (req.body?.roles && typeof req.body.roles === "object") ? req.body.roles : {};
  const roles: Record<string, CommunityRole> = {};
  for (const k of Object.keys(rolesIn)) {
    const v = rolesIn[k];
    if (v === "leader" || v === "vice" || v === "senior" || v === "member") {
      roles[k] = v;
    }
  }
  const createdAtNum = Number(req.body?.createdAt);
  const c: Community = {
    id, name,
    ...(avatar ? { avatar } : {}),
    members, createdBy,
    createdAt: Number.isFinite(createdAtNum) ? createdAtNum : Date.now(),
    roles,
  };
  const idx = communities.findIndex(x => x.id === id);
  if (idx === -1) communities.push(c);
  else communities[idx] = c;
  persistStore();
  res.json({ ok: true, community: c });
});

/** DELETE /communities/:id — dissolve and clear all related invites. */
router.delete("/communities/:id", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "id required" });
  for (let i = communities.length - 1; i >= 0; i--) {
    if (communities[i]!.id === id) communities.splice(i, 1);
  }
  for (let i = communityInvites.length - 1; i >= 0; i--) {
    if (communityInvites[i]!.communityId === id) communityInvites.splice(i, 1);
  }
  persistStore();
  res.json({ ok: true });
});

/**
 * POST /community-invites — send invites to N users for one community.
 * Body: { communityId, communityName, communityAvatar?, fromUserId,
 *         fromUserName, toUserIds: string[] }
 * Idempotent per (communityId, toUserId).
 */
router.post("/community-invites", (req, res): any => {
  const communityId = String(req.body?.communityId ?? "").trim();
  const communityName = String(req.body?.communityName ?? "").trim();
  const fromUserId = String(req.body?.fromUserId ?? "").trim();
  const fromUserName = String(req.body?.fromUserName ?? "").trim();
  const communityAvatar = req.body?.communityAvatar ? String(req.body.communityAvatar) : undefined;
  const toUserIds: string[] = Array.isArray(req.body?.toUserIds)
    ? req.body.toUserIds.map((x: unknown) => String(x)).filter(Boolean)
    : [];
  if (!communityId || !communityName || !fromUserId || toUserIds.length === 0) {
    return res.status(400).json({ error: "communityId/communityName/fromUserId/toUserIds required" });
  }
  const now = Date.now();
  let added = 0;
  for (const toUserId of toUserIds) {
    if (communityInvites.some(i => i.communityId === communityId && i.toUserId === toUserId)) continue;
    const inv: CommunityInvite = {
      communityId,
      toUserId,
      communityName,
      ...(communityAvatar ? { communityAvatar } : {}),
      fromUserId,
      fromUserName,
      invitedAt: now,
    };
    communityInvites.push(inv);
    added++;
  }
  if (added > 0) persistStore();
  res.json({ ok: true, added });
});

/** DELETE /community-invites/:communityId?userId=X — remove one invite. */
router.delete("/community-invites/:communityId", (req, res): any => {
  const communityId = String(req.params.communityId ?? "").trim();
  const userId = String(req.query.userId ?? req.body?.userId ?? "").trim();
  if (!communityId || !userId) return res.status(400).json({ error: "communityId/userId required" });
  let removed = 0;
  for (let i = communityInvites.length - 1; i >= 0; i--) {
    const inv = communityInvites[i]!;
    if (inv.communityId === communityId && inv.toUserId === userId) {
      communityInvites.splice(i, 1);
      removed++;
    }
  }
  if (removed > 0) persistStore();
  res.json({ ok: true, removed });
});

export default router;
