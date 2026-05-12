import { Router } from "express";
import {
  cafes, users, broadcasts, chatMessages, friendScope, persistStore, reports, usernameRegistry,
  orders, bookings, cafeViews, freeCoffees, friendRequests, friendships,
  reelLikes, reelComments, reelViews, coinGifts, cafeRatings,
  type Cafe, type Broadcast, type ChatMsg, type Report,
} from "../store";
import { geocodeAddress } from "../utils/geocode";

// Special "sender id" used when the super-admin direct-messages a user.
// The mobile app recognizes this id and renders the conversation as
// coming from "Copointo" with a brand avatar.
export const COPOINTO_ADMIN_ID = "copointo-admin";

const router = Router();

// ── GET /api/admin/cafes ────────────────────
router.get("/cafes", (_req, res) => {
  res.json({ cafes });
});

// ── POST /api/admin/cafes ───────────────────
router.post("/cafes", async (req, res) => {
  const { name, ownerName, ownerPhone, logo, openTime, closeTime, managerPassword, address, tags, subscriptionStart, subscriptionEnd, website, lat, lng } = req.body;
  if (!name || !ownerPhone || !openTime || !closeTime || !managerPassword) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const today = new Date().toISOString().split("T")[0];
  const oneYear = new Date(); oneYear.setFullYear(oneYear.getFullYear() + 1);
  const finalAddress = address || "عُمان";

  // Coordinates: only use BOTH manual values if valid; otherwise geocode
  const manualLat = lat !== undefined && lat !== null && lat !== "" ? Number(lat) : NaN;
  const manualLng = lng !== undefined && lng !== null && lng !== "" ? Number(lng) : NaN;
  let finalLat: number | undefined;
  let finalLng: number | undefined;
  if (Number.isFinite(manualLat) && Number.isFinite(manualLng)) {
    finalLat = manualLat; finalLng = manualLng;
  } else if (finalAddress) {
    const geo = await geocodeAddress(finalAddress);
    if (geo) { finalLat = geo.lat; finalLng = geo.lng; }
  }

  const newCafe: Cafe = {
    id: Date.now().toString(),
    name,
    ownerName: ownerName || "",
    ownerPhone,
    logo: logo || "",
    image: req.body.image || "",
    openTime,
    closeTime,
    managerPassword,
    active: true,
    subscriptionPaid: true,
    subscriptionAmount: req.body.subscriptionAmount != null && !Number.isNaN(Number(req.body.subscriptionAmount))
      ? Number(req.body.subscriptionAmount)
      : 300,
    subscriptionStart: subscriptionStart || today,
    subscriptionEnd:   subscriptionEnd   || oneYear.toISOString().split("T")[0],
    website: website || "",
    createdAt: new Date().toISOString(),
    rating: 4.5,
    tags: tags || [],
    address: finalAddress,
    lat: finalLat,
    lng: finalLng,
  };
  cafes.push(newCafe);
  res.status(201).json({ cafe: newCafe });
});

// ── PATCH /api/admin/cafes/:id/toggle ──────
router.patch("/cafes/:id/toggle", (req, res) => {
  const cafe = cafes.find(c => c.id === req.params.id);
  if (!cafe) return res.status(404).json({ error: "Cafe not found" });
  cafe.active = !cafe.active;
  res.json({ cafe });
});

// ── PATCH /api/admin/cafes/:id ─────────────
// Super-admin updates editable cafe fields. Any field omitted (or empty
// for managerPassword) is left unchanged. Immutable: id, createdAt.
router.patch("/cafes/:id", async (req, res): Promise<any> => {
  const cafe = cafes.find(c => c.id === req.params.id);
  if (!cafe) return res.status(404).json({ error: "Cafe not found" });

  const b = req.body ?? {};
  // Plain string/number fields — only assign when caller actually provided them.
  const assignIfPresent = <K extends keyof Cafe>(key: K, v: any) => {
    if (v !== undefined && v !== null) (cafe as any)[key] = v;
  };
  assignIfPresent("name",      typeof b.name      === "string" ? b.name      : undefined);
  assignIfPresent("ownerName", typeof b.ownerName === "string" ? b.ownerName : undefined);
  assignIfPresent("ownerPhone",typeof b.ownerPhone=== "string" ? b.ownerPhone: undefined);
  assignIfPresent("openTime",  typeof b.openTime  === "string" ? b.openTime  : undefined);
  assignIfPresent("closeTime", typeof b.closeTime === "string" ? b.closeTime : undefined);
  assignIfPresent("website",   typeof b.website   === "string" ? b.website   : undefined);
  assignIfPresent("subscriptionStart", typeof b.subscriptionStart === "string" ? b.subscriptionStart : undefined);
  assignIfPresent("subscriptionEnd",   typeof b.subscriptionEnd   === "string" ? b.subscriptionEnd   : undefined);
  if (b.subscriptionAmount !== undefined && b.subscriptionAmount !== null && !Number.isNaN(Number(b.subscriptionAmount))) {
    cafe.subscriptionAmount = Number(b.subscriptionAmount);
  }
  if (Array.isArray(b.tags)) cafe.tags = b.tags;
  // Images — empty string from the client means "clear it".
  if (typeof b.logo  === "string") cafe.logo  = b.logo;
  if (typeof b.image === "string") cafe.image = b.image;
  // Password — only update when a non-empty value is provided.
  if (typeof b.managerPassword === "string" && b.managerPassword.trim() !== "") {
    cafe.managerPassword = b.managerPassword;
  }

  // Address + coordinates: same logic as POST. If lat/lng provided & valid,
  // use them. Otherwise, when the address actually changed, re-geocode it.
  // Capture the OLD address BEFORE mutating it so the change-detection
  // works correctly.
  const oldAddress = cafe.address;
  const newAddress = (typeof b.address === "string" && b.address.trim() !== "")
    ? b.address
    : oldAddress;
  if (newAddress !== oldAddress) cafe.address = newAddress;

  const manualLat = b.lat !== undefined && b.lat !== null && b.lat !== "" ? Number(b.lat) : NaN;
  const manualLng = b.lng !== undefined && b.lng !== null && b.lng !== "" ? Number(b.lng) : NaN;
  if (Number.isFinite(manualLat) && Number.isFinite(manualLng)) {
    cafe.lat = manualLat; cafe.lng = manualLng;
  } else if (newAddress !== oldAddress) {
    // Address changed and no manual coords supplied — re-geocode.
    const geo = await geocodeAddress(newAddress);
    if (geo) { cafe.lat = geo.lat; cafe.lng = geo.lng; }
  }

  res.json({ cafe });
});

// ── DELETE /api/admin/cafes/:id ────────────
router.delete("/cafes/:id", (req, res) => {
  const idx = cafes.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Cafe not found" });
  cafes.splice(idx, 1);
  res.json({ success: true });
});

// ── GET /api/admin/users ────────────────────
router.get("/users", (_req, res) => {
  res.json({ users });
});

// ── DELETE /api/admin/users/:id ────────────
// Super-admin permanently removes a user and ALL of their identifying
// data. After this, the same phone number can register fresh as a brand
// new account. Business records (orders, bookings, invoices) are kept for
// the cafes' revenue history but anonymized — customer name becomes
// "مستخدم محذوف" and customerPhone is cleared. This is different from
// banning, which keeps everything but blocks login.
router.delete("/users/:id", (req, res): any => {
  const id  = req.params.id;
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  const phone = users[idx]!.phone;
  const norm  = (s: string) => String(s ?? "").replace(/\D+/g, "");
  const phoneN = norm(phone);

  // 1) Remove the user record itself.
  users.splice(idx, 1);

  // 2) Free the gameUsername so anyone else can claim it.
  for (let i = usernameRegistry.length - 1; i >= 0; i--) {
    if (usernameRegistry[i]!.userId === id) usernameRegistry.splice(i, 1);
  }

  // 3) Drop social graph: friend requests + friendships in either direction.
  for (let i = friendRequests.length - 1; i >= 0; i--) {
    const fr = friendRequests[i]!;
    if (fr.fromUserId === id || fr.toUserId === id) friendRequests.splice(i, 1);
  }
  for (let i = friendships.length - 1; i >= 0; i--) {
    const f = friendships[i]!;
    if (f.a === id || f.b === id) friendships.splice(i, 1);
  }

  // 4) Drop chats: messages sent by them + any 1:1 conversation involving
  //    them (scope contains their id). Group messages from other senders
  //    in groups they belonged to are kept (the group lives on for others).
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const m = chatMessages[i]!;
    const inFriendScope = m.kind === "friend" && m.scope.split("|").includes(id);
    if (m.senderId === id || inFriendScope) {
      chatMessages.splice(i, 1);
      continue;
    }
    // Strip them from seenBy so deleted user doesn't linger as a tick owner.
    if (Array.isArray(m.seenBy) && m.seenBy.includes(id)) {
      m.seenBy = m.seenBy.filter(x => x !== id);
    }
  }

  // 5) Drop reel engagement (likes / comments / views) by this user.
  for (let i = reelLikes.length - 1; i >= 0; i--) {
    if (reelLikes[i]!.userId === id || reelLikes[i]!.userId === phone) reelLikes.splice(i, 1);
  }
  for (let i = reelComments.length - 1; i >= 0; i--) {
    if (reelComments[i]!.userId === id || reelComments[i]!.userId === phone) reelComments.splice(i, 1);
  }
  for (let i = reelViews.length - 1; i >= 0; i--) {
    if (reelViews[i]!.userId === id || reelViews[i]!.userId === phone) reelViews.splice(i, 1);
  }

  // 6) Drop coin gifts pending for them and cafe ratings they submitted.
  for (let i = coinGifts.length - 1; i >= 0; i--) {
    if (coinGifts[i]!.userId === id) coinGifts.splice(i, 1);
  }
  for (let i = cafeRatings.length - 1; i >= 0; i--) {
    if (cafeRatings[i]!.userId === id) cafeRatings.splice(i, 1);
  }

  // 7) Drop free-coffee rewards owned by this phone (loyalty resets).
  for (let i = freeCoffees.length - 1; i >= 0; i--) {
    if (norm(freeCoffees[i]!.userPhone) === phoneN) freeCoffees.splice(i, 1);
  }

  // 8) Drop user-submitted reports (problem/cafe complaints).
  for (let i = reports.length - 1; i >= 0; i--) {
    const r = reports[i]!;
    if (r.reporterUserId === id || norm(r.phone) === phoneN) reports.splice(i, 1);
  }

  // 9) Anonymize cafe view tracking (keeps aggregate counts intact).
  for (const v of cafeViews) {
    if (v.userId === id || (v.userPhone && norm(v.userPhone) === phoneN)) {
      v.userId = undefined;
      v.userPhone = undefined;
    }
  }

  // 10) Anonymize business records (orders + bookings) so revenue history
  //     stays correct for the cafes but no PII remains for the deleted user.
  for (const o of orders) {
    if (o.userId === id || norm(o.customerPhone) === phoneN) {
      o.userId = undefined;
      o.customerName  = "مستخدم محذوف";
      o.customerPhone = "";
    }
  }
  for (const b of bookings) {
    if (norm(b.customerPhone) === phoneN) {
      b.customerName  = "مستخدم محذوف";
      b.customerPhone = "";
    }
  }

  persistStore();
  res.json({ ok: true });
});

// ── PATCH /api/admin/users/:id/ban ─────────
// Body: { reason?: string }
// Banning REQUIRES a reason (shown to the user in the mobile app). Unbanning
// (toggling off) clears the reason and bannedAt timestamp. Kept as PATCH +
// toggle for backwards compatibility with the existing admin UI.
router.patch("/users/:id/ban", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.banned) {
    // Already banned → unban (no reason required)
    user.banned = false;
    user.banReason = null;
    user.bannedAt = null;
  } else {
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) return res.status(400).json({ error: "سبب الحظر مطلوب" });
    if (reason.length > 500) return res.status(400).json({ error: "سبب الحظر طويل جداً (الحد الأقصى 500 حرف)" });
    user.banned = true;
    user.banReason = reason;
    user.bannedAt = new Date().toISOString();
  }
  persistStore();
  res.json({ user });
});

// ── POST /api/admin/users/:id/game-ban ─────
// Body: { reason: string }
// Permanently bans user from the game (ranking hidden, game tab blocked).
// Cafe ordering & points keep working.
router.post("/users/:id/game-ban", (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) return res.status(400).json({ error: "Reason is required" });
  user.gameBanned = true;
  user.gameSuspendedUntil = null;
  user.gameSuspendReason = reason;
  user.gameSuspendedAt = new Date().toISOString();
  res.json({ user });
});

// ── POST /api/admin/users/:id/game-suspend ─
// Body: { days: number, reason: string }
// Temporarily suspends the user from the game for `days` days.
router.post("/users/:id/game-suspend", (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const days   = Number(req.body?.days);
  const reason = String(req.body?.reason ?? "").trim();
  if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ error: "Invalid days" });
  if (!reason) return res.status(400).json({ error: "Reason is required" });
  const until = new Date();
  until.setDate(until.getDate() + Math.floor(days));
  user.gameBanned = false;
  user.gameSuspendedUntil = until.toISOString();
  user.gameSuspendReason = reason;
  user.gameSuspendedAt = new Date().toISOString();
  res.json({ user });
});

// ── POST /api/admin/users/:id/game-clear ───
// Lifts any active game ban or suspension.
router.post("/users/:id/game-clear", (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.gameBanned = false;
  user.gameSuspendedUntil = null;
  user.gameSuspendReason = null;
  user.gameSuspendedAt = null;
  res.json({ user });
});

// ── POST /api/admin/users/:id/message ──────
// Body: { message: string }
// Super-admin sends a direct message to ONE user. Stored as a regular
// chatMessage with senderId = COPOINTO_ADMIN_ID so the mobile app picks
// it up via its existing /messages poll loop and renders it as a
// conversation from "Copointo".
router.post("/users/:id/message", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const text = String(req.body?.message ?? "").trim();
  if (!text)            return res.status(400).json({ error: "الرسالة مطلوبة" });
  if (text.length > 1000) return res.status(400).json({ error: "الرسالة طويلة جداً (الحد الأقصى 1000 حرف)" });
  const msg: ChatMsg = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    kind: "friend",
    scope: friendScope(COPOINTO_ADMIN_ID, user.id),
    senderId: COPOINTO_ADMIN_ID,
    text,
    createdAt: new Date().toISOString(),
    seenBy: [COPOINTO_ADMIN_ID],
  };
  chatMessages.push(msg);
  persistStore();
  res.json({ ok: true, message: msg });
});

// ── POST /api/admin/broadcasts ─────────────
// Body: { message: string }
// Super-admin sends a broadcast to all game users (system notification from Copointo).
router.post("/broadcasts", (req, res): any => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) return res.status(400).json({ error: "الرسالة مطلوبة" });
  if (message.length > 500) return res.status(400).json({ error: "الرسالة طويلة جداً (الحد الأقصى 500 حرف)" });
  const b: Broadcast = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    message,
    createdAt: new Date().toISOString(),
  };
  broadcasts.unshift(b);
  res.json({ broadcast: b });
});

// ── GET /api/admin/broadcasts ──────────────
// Returns broadcast history (newest first) for the super-admin panel.
router.get("/broadcasts", (_req, res) => {
  res.json({ broadcasts });
});

// ── DELETE /api/admin/broadcasts/:id ───────
router.delete("/broadcasts/:id", (req, res): any => {
  const i = broadcasts.findIndex(b => b.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Broadcast not found" });
  broadcasts.splice(i, 1);
  res.json({ ok: true });
});

// ── GET /api/admin/reports ─────────────────
// Returns every user-submitted report (newest first). For "cafe" reports we
// enrich with the live cafe details so the super-admin can act on the
// complaint without a second lookup.
router.get("/reports", (_req, res) => {
  const enriched = [...reports]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(r => {
      if (r.kind !== "cafe" || !r.cafeId) return r;
      const cafe = cafes.find(c => c.id === r.cafeId);
      return {
        ...r,
        cafe: cafe ? {
          id: cafe.id, name: cafe.name, logo: cafe.logo, image: cafe.image,
          ownerName: cafe.ownerName, ownerPhone: cafe.ownerPhone,
          address: cafe.address, active: cafe.active,
        } : null,
      };
    });
  res.json({ reports: enriched });
});

// ── PATCH /api/admin/reports/:id ────────────
// Toggle status open ↔ resolved.
router.patch("/reports/:id", (req, res): any => {
  const r = reports.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "Report not found" });
  const next = req.body?.status === "resolved" ? "resolved" : "open";
  r.status = next;
  persistStore();
  res.json({ report: r });
});

// ── DELETE /api/admin/reports/:id ───────────
router.delete("/reports/:id", (req, res): any => {
  const i = reports.findIndex(x => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Report not found" });
  reports.splice(i, 1);
  persistStore();
  res.json({ ok: true });
});

// ── GET /api/admin/stats ────────────────────
router.get("/stats", (_req, res) => {
  const totalCafes   = cafes.length;
  const activeCafes  = cafes.filter(c => c.active).length;
  const totalRevenue = cafes.filter(c => c.subscriptionPaid).length * 300;
  const totalUsers   = users.length;
  const bannedUsers  = users.filter(u => u.banned).length;
  res.json({ totalCafes, activeCafes, totalRevenue, totalUsers, bannedUsers });
});

// ── GET /api/cafes (public — mobile app) ────
router.get("/public", (_req, res) => {
  const publicCafes = cafes.filter(c => c.active).map(c => ({
    id: c.id, name: c.name, logo: c.logo, image: c.image,
    openTime: c.openTime, closeTime: c.closeTime,
    rating: c.rating, tags: c.tags, address: c.address,
  }));
  res.json({ cafes: publicCafes });
});

export default router;
