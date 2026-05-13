import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import {
  cafes, users, broadcasts, chatMessages, friendScope, persistStore, reports,
  purgeUserData, purgeCafeData, reels, wipeAllData,
  communities, communityInvites,
  type Cafe, type Broadcast, type ChatMsg, type Report,
} from "../store";
import { deleteReelFile } from "../lib/objectStorage";
import { geocodeAddress } from "../utils/geocode";

// Same on-disk reels folder used by the cafe-dashboard upload route.
// Kept here so the super-admin "delete cafe" path can clean up legacy
// `file:` reel uploads without round-tripping through the cafe routes.
const REELS_DIR = path.join(process.cwd(), "uploads", "reels");

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
// Super-admin permanently deletes a cafe AND every record that references
// it: menu, tables, orders, bookings, invoices, expenses, inventory,
// discount codes, reels (+ likes/comments/views & their video files),
// chat info, invoice templates, gift vouchers, ratings, cafe-views, and
// cafe-targeted reports. After this the cafe leaves no trace and the same
// owner phone or cafe name is free to register again as a fresh cafe with
// a brand-new id and zero residual data.
router.delete("/cafes/:id", (req, res) => {
  const id = req.params.id;
  const cafe = cafes.find(c => c.id === id);
  if (!cafe) return res.status(404).json({ error: "Cafe not found" });

  // Snapshot reel video keys BEFORE the in-memory purge so we can still
  // best-effort delete the underlying files (GCS objects + legacy on-disk
  // uploads) after the rows are gone.
  const reelVideoUrls: string[] = reels
    .filter(r => r.cafeId === id)
    .map(r => r.videoUrl);

  const ok = purgeCafeData(id);
  if (!ok) return res.status(404).json({ error: "Cafe not found" });

  for (const url of reelVideoUrls) {
    if (url?.startsWith("gcs:")) {
      void deleteReelFile(url.slice(4));
    } else if (url?.startsWith("file:")) {
      const safe = path.basename(url.slice(5));
      if (safe && safe !== "." && safe !== "..") {
        const filePath = path.resolve(REELS_DIR, safe);
        if (filePath.startsWith(path.resolve(REELS_DIR) + path.sep)) {
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        }
      }
    }
  }

  res.json({ success: true });
});

// ── POST /api/admin/wipe-everything ───────
// DESTRUCTIVE super-admin reset: empties EVERY collection (users, cafes,
// orders, bookings, leaderboard/usernameRegistry, friends, chats, reels,
// invoices, reports, broadcasts, gift vouchers, free coffees — all of it)
// in BOTH memory and the kv_store table, so the platform restarts clean.
//
// Guarded by a server-side bearer token that must equal `SESSION_SECRET`
// (already set in env). The token NEVER appears in client code or logs;
// the operator passes it manually as `Authorization: Bearer <token>`.
//
// There is no undo — this is meant for the platform owner only, e.g. a
// fresh launch reset after testing.
router.post("/wipe-everything", async (req, res): Promise<any> => {
  const expected = process.env.SESSION_SECRET;
  if (!expected) {
    return res.status(500).json({ error: "SESSION_SECRET not configured" });
  }
  const auth = String(req.headers.authorization ?? "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await wipeAllData();
    return res.json({ success: true, wipedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
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
  const ok = purgeUserData(req.params.id);
  if (!ok) return res.status(404).json({ error: "User not found" });
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

// ─── Communities (super-admin) ─────────────────────────────────────────
// Same rank tiers as the mobile app (data/mockData.ts → RANKS).
const ADMIN_RANKS = [
  { min: 0,   max: 100,  name: "مبتدئ كوفي",   icon: "☕" },
  { min: 101, max: 200,  name: "هاوي كوفي",    icon: "🫖" },
  { min: 201, max: 300,  name: "محترف كوفي",   icon: "⭐" },
  { min: 301, max: 400,  name: "كبير كوفي",    icon: "🏅" },
  { min: 401, max: 500,  name: "عالمي كوفي",   icon: "🌍" },
  { min: 501, max: 600,  name: "مجنون كوفي",   icon: "🔥" },
  { min: 601, max: 700,  name: "مخضرم كوفي",   icon: "💎" },
  { min: 701, max: 800,  name: "عمدة الكوفي",  icon: "👑" },
  { min: 801, max: 900,  name: "ملك الكوفي",   icon: "🏆" },
  { min: 901, max: 1000, name: "نخبة الكوفي",  icon: "⚡" },
];
function adminRankFor(level: number) {
  return ADMIN_RANKS.find(r => level >= r.min && level <= r.max) || ADMIN_RANKS[0]!;
}
const ROLE_LABELS_AR: Record<string, string> = {
  leader: "قائد", vice: "قائد مساعد", senior: "عضو كبير", member: "عضو",
};

// GET /api/admin/communities — list every community + enriched member rows.
router.get("/communities", (_req, res) => {
  const list = communities.map(c => {
    const memberRows = c.members.map(uid => {
      const u = users.find(x => x.id === uid);
      const role = (c.roles && c.roles[uid]) || (uid === c.createdBy ? "leader" : "member");
      const level = u?.level ?? 0;
      const rank = adminRankFor(level);
      return {
        id: uid,
        name: u?.name || u?.username || "—",
        username: u?.username || "",
        phone: u?.phone || "",
        avatar: u?.avatar || null,
        gender: u?.gender || null,
        level,
        totalOrders: u?.totalOrders ?? 0,
        rankName: rank.name,
        rankIcon: rank.icon,
        roleKey: role,
        roleLabel: ROLE_LABELS_AR[role] || role,
        banned: !!u?.banned,
      };
    });
    // Sort: leader → vice → senior → member, then by level desc.
    const order: Record<string, number> = { leader: 0, vice: 1, senior: 2, member: 3 };
    memberRows.sort((a, b) => {
      const r = (order[a.roleKey] ?? 9) - (order[b.roleKey] ?? 9);
      if (r !== 0) return r;
      return b.level - a.level;
    });
    const totalLevel = memberRows.reduce((s, m) => s + (m.level || 0), 0);
    const totalOrders = memberRows.reduce((s, m) => s + (m.totalOrders || 0), 0);
    return {
      id: c.id,
      name: c.name,
      avatar: c.avatar || null,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      memberCount: memberRows.length,
      totalLevel,
      totalOrders,
      members: memberRows,
    };
  });
  // Most-points first.
  list.sort((a, b) => b.totalLevel - a.totalLevel || b.memberCount - a.memberCount);
  res.json({ communities: list });
});

// POST /api/admin/communities/:id/ban  body: { reason }
// Hard-ban a community: delete it + all its invites, then push a TARGETED
// broadcast (toUserIds = former members) so each member sees the reason in
// their notifications screen on next poll. Cafe-side data is untouched.
router.post("/communities/:id/ban", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  const reason = String(req.body?.reason ?? "").trim();
  if (!id) return res.status(400).json({ error: "id مطلوب" });
  if (!reason) return res.status(400).json({ error: "السبب مطلوب" });
  if (reason.length > 500) return res.status(400).json({ error: "السبب طويل جداً (الحد الأقصى 500 حرف)" });

  const idx = communities.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: "المجتمع غير موجود" });
  const community = communities[idx]!;
  const memberIds = [...community.members];
  const name = community.name;

  // Remove the community + every related invite.
  communities.splice(idx, 1);
  for (let i = communityInvites.length - 1; i >= 0; i--) {
    if (communityInvites[i]!.communityId === id) communityInvites.splice(i, 1);
  }

  // Targeted broadcast — only the former members will see it.
  if (memberIds.length > 0) {
    const b: Broadcast = {
      id: `bc_cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message: `تم حظر مجتمع "${name}" من قِبل إدارة كوبوينتو.\nالسبب: ${reason}`,
      createdAt: new Date().toISOString(),
      toUserIds: memberIds,
    };
    broadcasts.unshift(b);
  }

  persistStore();
  res.json({ ok: true, removedMembers: memberIds.length });
});

export default router;
